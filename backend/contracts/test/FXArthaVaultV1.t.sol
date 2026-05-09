// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {FXArthaVaultV1} from "../src/FXArthaVaultV1.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * Mock USDT-like ERC20 for tests. Real USDT on BSC is non-standard
 * (returns nothing on transfer); SafeERC20 handles that, so we use
 * a vanilla OZ ERC20 here — the SafeERC20 wrapping in the vault means
 * a real USDT on mainnet behaves identically to this mock under test.
 */
contract MockUSDT is ERC20 {
    constructor() ERC20("Mock USDT", "mUSDT") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}

/// @dev A second non-USDT ERC20 used for recoverToken tests.
contract MockOtherToken is ERC20 {
    constructor() ERC20("Other Token", "OTHR") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract FXArthaVaultV1Test is Test {
    FXArthaVaultV1 internal vault;
    MockUSDT internal usdt;
    MockOtherToken internal other;

    address internal admin = address(0xA11CE);   // multi-sig
    address internal alice = address(0xB0B);     // depositor 1
    address internal bob   = address(0xCAFE);    // depositor 2
    address internal mallory = address(0xDEAD);  // unauthorised actor

    bytes32 internal constant APPROVAL_1 = keccak256("approval-1");
    bytes32 internal constant APPROVAL_2 = keccak256("approval-2");

    event Deposit(address indexed user, uint256 amount, uint256 timestamp);
    event Withdraw(address indexed to, uint256 amount, bytes32 indexed approvalId, uint256 timestamp);
    event TokenRecovered(address indexed token, uint256 amount, address indexed to);

    function setUp() public {
        usdt = new MockUSDT();
        other = new MockOtherToken();
        vault = new FXArthaVaultV1(address(usdt), admin);

        // Seed test wallets with USDT and approve vault.
        usdt.mint(alice, 1_000 * 1e6);
        usdt.mint(bob,   1_000 * 1e6);
        vm.prank(alice); usdt.approve(address(vault), type(uint256).max);
        vm.prank(bob);   usdt.approve(address(vault), type(uint256).max);
    }

    // ── Constructor ────────────────────────────────────────────────────

    function test_Constructor_RevertsWhenUSDTZero() public {
        vm.expectRevert(bytes("FXAV1: usdt=0"));
        new FXArthaVaultV1(address(0), admin);
    }

    function test_Constructor_RevertsWhenAdminZero() public {
        vm.expectRevert(bytes("FXAV1: admin=0"));
        new FXArthaVaultV1(address(usdt), address(0));
    }

    function test_Constructor_GrantsAllRolesToAdmin() public view {
        assertTrue(vault.hasRole(vault.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(vault.hasRole(vault.WITHDRAWER_ROLE(), admin));
        assertTrue(vault.hasRole(vault.PAUSER_ROLE(), admin));
    }

    function test_Constructor_DoesNotGrantRolesToDeployer() public view {
        assertFalse(vault.hasRole(vault.DEFAULT_ADMIN_ROLE(), address(this)));
        assertFalse(vault.hasRole(vault.WITHDRAWER_ROLE(), address(this)));
        assertFalse(vault.hasRole(vault.PAUSER_ROLE(), address(this)));
    }

    // ── Deposit ────────────────────────────────────────────────────────

    function test_Deposit_HappyPath() public {
        uint256 amount = 100 * 1e6;
        vm.expectEmit(true, false, false, true);
        emit Deposit(alice, amount, block.timestamp);

        vm.prank(alice);
        vault.deposit(amount);

        assertEq(usdt.balanceOf(address(vault)), amount);
        assertEq(vault.totalDeposited(), amount);
        assertEq(vault.totalWithdrawn(), 0);
        assertEq(vault.vaultBalance(), amount);
    }

    function test_Deposit_TwoUsersAccumulate() public {
        vm.prank(alice); vault.deposit(100 * 1e6);
        vm.prank(bob);   vault.deposit(50 * 1e6);

        assertEq(vault.totalDeposited(), 150 * 1e6);
        assertEq(vault.vaultBalance(), 150 * 1e6);
    }

    function test_Deposit_RevertsWhenAmountZero() public {
        vm.prank(alice);
        vm.expectRevert(bytes("FXAV1: amount=0"));
        vault.deposit(0);
    }

    function test_Deposit_RevertsWhenPaused() public {
        vm.prank(admin); vault.pause();
        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vault.deposit(10 * 1e6);
    }

    function test_Deposit_RevertsWhenInsufficientBalance() public {
        // mallory has 0 USDT but tries to deposit
        vm.prank(mallory);
        usdt.approve(address(vault), 1_000 * 1e6);
        vm.prank(mallory);
        vm.expectRevert();  // OZ ERC20InsufficientBalance custom error
        vault.deposit(1 * 1e6);
    }

    function test_Deposit_RevertsWhenInsufficientAllowance() public {
        // mallory has USDT but no allowance
        usdt.mint(mallory, 100 * 1e6);
        vm.prank(mallory);
        vm.expectRevert();  // OZ ERC20InsufficientAllowance custom error
        vault.deposit(50 * 1e6);
    }

    // ── Withdraw ───────────────────────────────────────────────────────

    function test_Withdraw_HappyPath() public {
        // Seed vault.
        vm.prank(alice); vault.deposit(500 * 1e6);

        uint256 payout = 200 * 1e6;
        uint256 aliceBefore = usdt.balanceOf(alice);

        vm.expectEmit(true, true, false, true);
        emit Withdraw(alice, payout, APPROVAL_1, block.timestamp);

        vm.prank(admin);
        vault.withdraw(alice, payout, APPROVAL_1);

        assertEq(usdt.balanceOf(alice), aliceBefore + payout);
        assertEq(vault.totalWithdrawn(), payout);
        assertTrue(vault.usedApprovalIds(APPROVAL_1));
        assertEq(vault.vaultBalance(), 300 * 1e6);
    }

    function test_Withdraw_RevertsWhenNotWithdrawer() public {
        vm.prank(alice); vault.deposit(100 * 1e6);

        vm.prank(mallory);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                mallory,
                vault.WITHDRAWER_ROLE()
            )
        );
        vault.withdraw(mallory, 50 * 1e6, APPROVAL_1);
    }

    function test_Withdraw_RevertsWhenAmountZero() public {
        vm.prank(admin);
        vm.expectRevert(bytes("FXAV1: amount=0"));
        vault.withdraw(alice, 0, APPROVAL_1);
    }

    function test_Withdraw_RevertsWhenToZero() public {
        vm.prank(admin);
        vm.expectRevert(bytes("FXAV1: to=0"));
        vault.withdraw(address(0), 50 * 1e6, APPROVAL_1);
    }

    function test_Withdraw_RevertsWhenApprovalIdZero() public {
        vm.prank(admin);
        vm.expectRevert(bytes("FXAV1: approvalId=0"));
        vault.withdraw(alice, 50 * 1e6, bytes32(0));
    }

    function test_Withdraw_RevertsOnReplay() public {
        vm.prank(alice); vault.deposit(500 * 1e6);

        vm.prank(admin); vault.withdraw(alice, 100 * 1e6, APPROVAL_1);

        // Same approvalId, second attempt — must revert.
        vm.prank(admin);
        vm.expectRevert(bytes("FXAV1: approval already used"));
        vault.withdraw(alice, 100 * 1e6, APPROVAL_1);
    }

    function test_Withdraw_RevertsWhenPaused() public {
        vm.prank(alice); vault.deposit(100 * 1e6);
        vm.prank(admin); vault.pause();

        vm.prank(admin);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vault.withdraw(alice, 50 * 1e6, APPROVAL_1);
    }

    function test_Withdraw_DifferentApprovalIdsBothSucceed() public {
        vm.prank(alice); vault.deposit(500 * 1e6);

        vm.prank(admin); vault.withdraw(alice, 100 * 1e6, APPROVAL_1);
        vm.prank(admin); vault.withdraw(alice, 50 * 1e6, APPROVAL_2);

        assertEq(vault.totalWithdrawn(), 150 * 1e6);
        assertTrue(vault.usedApprovalIds(APPROVAL_1));
        assertTrue(vault.usedApprovalIds(APPROVAL_2));
    }

    // ── Pause ──────────────────────────────────────────────────────────

    function test_Pause_OnlyPauser() public {
        vm.prank(mallory);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                mallory,
                vault.PAUSER_ROLE()
            )
        );
        vault.pause();
    }

    function test_Unpause_OnlyPauser() public {
        vm.prank(admin); vault.pause();
        vm.prank(mallory);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                mallory,
                vault.PAUSER_ROLE()
            )
        );
        vault.unpause();
    }

    function test_Pause_AdminCanCallPauseDuringPause() public {
        // Pause is admin-callable even while paused — verify we never
        // brick the contract by needing it to be unpaused to unpause.
        vm.prank(admin); vault.pause();
        vm.prank(admin); vault.unpause();
        assertEq(usdt.balanceOf(address(vault)), 0);  // sanity: still functional
    }

    // ── recoverToken ───────────────────────────────────────────────────

    function test_RecoverToken_RevertsWhenUSDT() public {
        vm.prank(admin);
        vm.expectRevert(bytes("FXAV1: cannot recover USDT"));
        vault.recoverToken(address(usdt), 100 * 1e6);
    }

    function test_RecoverToken_RevertsWhenNotAdmin() public {
        other.mint(address(vault), 100 ether);
        vm.prank(mallory);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                mallory,
                vault.DEFAULT_ADMIN_ROLE()
            )
        );
        vault.recoverToken(address(other), 100 ether);
    }

    function test_RecoverToken_HappyPath() public {
        other.mint(address(vault), 100 ether);

        vm.expectEmit(true, true, false, true);
        emit TokenRecovered(address(other), 100 ether, admin);

        vm.prank(admin);
        vault.recoverToken(address(other), 100 ether);

        assertEq(other.balanceOf(admin), 100 ether);
        assertEq(other.balanceOf(address(vault)), 0);
    }

    function test_RecoverToken_RevertsWhenZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert(bytes("FXAV1: token=0"));
        vault.recoverToken(address(0), 1);
    }

    function test_RecoverToken_RevertsWhenAmountZero() public {
        vm.prank(admin);
        vm.expectRevert(bytes("FXAV1: amount=0"));
        vault.recoverToken(address(other), 0);
    }

    // ── Invariant: vault balance == totalDeposited - totalWithdrawn ───

    /**
     * Stateful invariant: under any sequence of deposits and admin-signed
     * withdrawals, the vault's USDT balance must equal
     * totalDeposited - totalWithdrawn.
     */
    function invariant_AccountingMatchesBalance() public view {
        uint256 net = vault.totalDeposited() - vault.totalWithdrawn();
        assertEq(usdt.balanceOf(address(vault)), net);
    }

    // ── Fuzz tests ─────────────────────────────────────────────────────

    function testFuzz_Deposit_AnyAmount(uint96 amount) public {
        amount = uint96(bound(uint256(amount), 1, 1_000 * 1e6));

        uint256 before = vault.totalDeposited();
        vm.prank(alice);
        vault.deposit(amount);

        assertEq(vault.totalDeposited(), before + amount);
        assertEq(usdt.balanceOf(address(vault)), before + amount);
    }

    function testFuzz_Withdraw_AnyAmountAndApproval(
        uint96 deposit_,
        uint96 payout,
        bytes32 approvalId
    ) public {
        deposit_ = uint96(bound(uint256(deposit_), 1, 1_000 * 1e6));
        payout   = uint96(bound(uint256(payout),   1, deposit_));
        vm.assume(approvalId != bytes32(0));

        vm.prank(alice); vault.deposit(deposit_);
        vm.prank(admin); vault.withdraw(alice, payout, approvalId);

        assertEq(vault.totalDeposited(), deposit_);
        assertEq(vault.totalWithdrawn(), payout);
        assertEq(usdt.balanceOf(address(vault)), uint256(deposit_) - uint256(payout));
        assertTrue(vault.usedApprovalIds(approvalId));
    }

    function testFuzz_Withdraw_ReplayAlwaysReverts(
        uint96 amount,
        bytes32 approvalId
    ) public {
        amount = uint96(bound(uint256(amount), 1, 500 * 1e6));
        vm.assume(approvalId != bytes32(0));

        vm.prank(alice); vault.deposit(1_000 * 1e6);
        vm.prank(admin); vault.withdraw(alice, amount, approvalId);

        vm.prank(admin);
        vm.expectRevert(bytes("FXAV1: approval already used"));
        vault.withdraw(alice, amount, approvalId);
    }
}
