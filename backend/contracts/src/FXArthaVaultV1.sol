// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title FXArthaVaultV1
 * @notice Custody vault for FXArtha — holds a single ERC20 stablecoin
 *         (USDT in production) on behalf of all platform users.
 *
 * Design intent (Phase 1):
 *   • Aggregate custody only — no per-user balances on-chain. The
 *     backend ledger (PostgreSQL) is authoritative for what each user
 *     can withdraw. The vault simply holds the pooled funds and
 *     emits Deposit / Withdraw events the verifier engine consumes
 *     to keep the off-chain ledger in sync.
 *   • Withdrawals are role-gated and idempotent — every approved
 *     withdrawal carries a backend-generated UUID (`approvalId`); a
 *     re-broadcast of the same tx after one was already processed is
 *     blocked at the contract level via `usedApprovalIds`.
 *   • Multi-sig admin — the multi-sig holds DEFAULT_ADMIN_ROLE,
 *     WITHDRAWER_ROLE, and PAUSER_ROLE. No single key can drain.
 *   • Non-upgradeable — bug fixes ship as a new contract + DB
 *     migration, not as a proxy upgrade. Smaller audit surface,
 *     no admin-proxy compromise risk.
 *
 * What this contract intentionally does NOT do:
 *   • per-user balance accounting
 *   • orderbook / matching / leverage
 *   • bridges / cross-chain
 *   • protocol-token, staking, referral mechanics
 *
 * Reference: docs/vault-phase1-spec.md
 */
contract FXArthaVaultV1 is AccessControl, Pausable {
    using SafeERC20 for IERC20;

    /// @notice The stablecoin this vault custodies. Set in constructor; never changes.
    IERC20 public immutable USDT;

    /// @notice Lifetime sum of all deposits (monotonically increasing).
    uint256 public totalDeposited;

    /// @notice Lifetime sum of all paid-out withdrawals (monotonically increasing).
    uint256 public totalWithdrawn;

    /// @notice One-shot consumption table for backend-supplied approval IDs.
    ///         Set true the first time a withdrawal with that id is signed,
    ///         blocking any subsequent attempt to re-use the same id.
    mapping(bytes32 => bool) public usedApprovalIds;

    /// @notice Role authorised to sign approved payouts via withdraw().
    ///         Granted to the multi-sig at deploy time.
    bytes32 public constant WITHDRAWER_ROLE = keccak256("WITHDRAWER_ROLE");

    /// @notice Role authorised to call pause() / unpause(). Held by the
    ///         multi-sig and an on-call ops EOA so an emergency stop is
    ///         faster than rotating Safe signers.
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // ── Events ─────────────────────────────────────────────────────────

    /// @notice Emitted on every successful user deposit. Backend's
    ///         chain_verifier_engine matches `user` against
    ///         users.wallet_address (lowercased) and credits
    ///         users.main_wallet_balance by `amount`.
    event Deposit(address indexed user, uint256 amount, uint256 timestamp);

    /// @notice Emitted on every paid-out withdrawal. Backend matches
    ///         `approvalId` against withdrawals.approval_id and flips
    ///         status='paid'. Note `to` (NOT msg.sender, which is the
    ///         multi-sig signer) is the destination address.
    event Withdraw(address indexed to, uint256 amount, bytes32 indexed approvalId, uint256 timestamp);

    /// @notice Emitted when admin recovers a non-USDT token accidentally
    ///         sent to this contract. The recovered token can NEVER be USDT.
    event TokenRecovered(address indexed token, uint256 amount, address indexed to);

    // ── Constructor ────────────────────────────────────────────────────

    /**
     * @param _usdt   Address of the stablecoin ERC20 to custody.
     * @param _admin  Multi-sig address that receives DEFAULT_ADMIN_ROLE,
     *                WITHDRAWER_ROLE, and PAUSER_ROLE. Use deploy script
     *                to additionally grant PAUSER_ROLE to an ops EOA if
     *                desired.
     *
     * The deployer EOA is NOT granted any role. After construction the
     * multi-sig is the only privileged actor, even before the deploy
     * script's role-revocation step runs.
     */
    constructor(address _usdt, address _admin) {
        require(_usdt != address(0), "FXAV1: usdt=0");
        require(_admin != address(0), "FXAV1: admin=0");

        USDT = IERC20(_usdt);

        // Grant all admin roles to the multi-sig only. The deployer EOA
        // is intentionally NOT given DEFAULT_ADMIN_ROLE — there's no
        // bootstrap-then-revoke step and therefore no window where the
        // deployer key can drain.
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(WITHDRAWER_ROLE, _admin);
        _grantRole(PAUSER_ROLE, _admin);
    }

    // ── User-facing: deposit ───────────────────────────────────────────

    /**
     * @notice Deposit `amount` of USDT into the vault.
     * @dev    User must `USDT.approve(vault, amount)` before calling.
     *         Pulls the funds via SafeERC20.transferFrom and emits a
     *         Deposit event the verifier engine consumes.
     * @param  amount  USDT base units (6 decimals on most chains).
     */
    function deposit(uint256 amount) external whenNotPaused {
        require(amount > 0, "FXAV1: amount=0");

        // Effects before interaction not strictly required (transferFrom
        // can revert; if it does, the state change rolls back), but
        // updating totalDeposited *after* the transfer keeps it in sync
        // with what was actually pulled in case of a fee-on-transfer
        // token. USDT itself isn't fee-on-transfer so this is mostly
        // forward-compatibility.
        uint256 balanceBefore = USDT.balanceOf(address(this));
        USDT.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = USDT.balanceOf(address(this)) - balanceBefore;

        // Use the actually-received amount to defend against fee-on-transfer
        // tokens (USDT itself doesn't have transfer fees, but the vault
        // shouldn't trust that the configured token won't be swapped one day).
        totalDeposited += received;

        emit Deposit(msg.sender, received, block.timestamp);
    }

    // ── Admin-facing: withdraw ─────────────────────────────────────────

    /**
     * @notice Pay out `amount` of USDT to `to`. Only callable by an
     *         account that holds WITHDRAWER_ROLE (the multi-sig).
     * @dev    `approvalId` is generated by the backend per approved
     *         withdrawal request. It must be unique across the vault's
     *         lifetime — this contract enforces single-use via
     *         usedApprovalIds. Backend stores the same id in
     *         withdrawals.approval_id so the verifier engine can match
     *         the on-chain event to the local row.
     *
     * @param to          Destination address. Backend hard-locks this to
     *                    user.wallet_address; we re-validate non-zero.
     * @param amount      USDT base units.
     * @param approvalId  Idempotency key. Replaying a tx with the same
     *                    id reverts with "approval already used".
     */
    function withdraw(
        address to,
        uint256 amount,
        bytes32 approvalId
    ) external onlyRole(WITHDRAWER_ROLE) whenNotPaused {
        require(amount > 0, "FXAV1: amount=0");
        require(to != address(0), "FXAV1: to=0");
        require(approvalId != bytes32(0), "FXAV1: approvalId=0");
        require(!usedApprovalIds[approvalId], "FXAV1: approval already used");

        // Effects BEFORE interactions — Checks-Effects-Interactions.
        // Setting the bit before the external transfer makes replay
        // impossible even if the transfer reverts.
        usedApprovalIds[approvalId] = true;
        totalWithdrawn += amount;

        USDT.safeTransfer(to, amount);

        emit Withdraw(to, amount, approvalId, block.timestamp);
    }

    // ── Admin-facing: emergency controls ───────────────────────────────

    /**
     * @notice Halt deposits and withdrawals. Existing user balance in the
     *         vault is unaffected — pause is purely a circuit breaker that
     *         blocks new flow until ops investigates and unpauses.
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice Resume deposits and withdrawals.
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @notice Sweep accidentally-sent non-USDT tokens out of the vault.
     *         The custody asset (USDT) can NEVER be recovered via this
     *         path — every withdrawal of USDT must go through the
     *         role-gated, idempotent withdraw() function above.
     *
     * @param token  ERC20 contract address; reverts if equal to USDT.
     * @param amount Amount to sweep.
     */
    function recoverToken(address token, uint256 amount)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(token != address(USDT), "FXAV1: cannot recover USDT");
        require(token != address(0), "FXAV1: token=0");
        require(amount > 0, "FXAV1: amount=0");

        IERC20(token).safeTransfer(msg.sender, amount);
        emit TokenRecovered(token, amount, msg.sender);
    }

    // ── View helpers ───────────────────────────────────────────────────

    /**
     * @notice Outstanding USDT custodied. Should always equal
     *         totalDeposited - totalWithdrawn under the invariant.
     *         Backend monitors any divergence as a critical alert.
     */
    function vaultBalance() external view returns (uint256) {
        return USDT.balanceOf(address(this));
    }
}
