# Ezymex platform help articles (seed for the support bot's knowledge base).
# Format: "## slug | Category | Title", then an optional "tags: a, b" line, then the body (markdown).
# Seeded once per tenant (source 'seed'); staff edit them in Back Office -> Support -> AI knowledge base.

## open-account | Accounts | Opening a trading account
tags: account, open, live, demo, new account, create
Open accounts from **Accounts -> Open account** in the Client Area. Choose **Live** or **Demo**, pick an account type (group) and a leverage, and set a trading password (or let us generate one). Your login and passwords are shown once when the account is created, so save them.

- A demo account starts with virtual funds and can be refilled from the account page. Demo accounts may expire after a period of inactivity set by the broker.
- A live account starts empty. Fund it by moving money from your Ezymex wallet with **Wallet -> Transfer**.
- Each account type has a limit on how many accounts you can hold. If you reach it, the form tells you.

## account-types | Accounts | Account types, netting and hedging, cent accounts
tags: group, account type, netting, hedging, cent, leverage, spread, commission
Every trading account belongs to an account type (group) that sets its trading conditions: spreads, commission per lot, maximum leverage, swap rules, and the margin call and stop-out levels. You can compare account types on **Accounts -> Open account**.

- **Netting** accounts hold one position per symbol; a new order in the opposite direction reduces or closes it.
- **Hedging** accounts can hold several positions per symbol, including buys and sells at the same time.
- **Cent** accounts show the balance in cents (1 USD = 100 USC), which is useful for trading very small sizes.

## leverage | Accounts | Changing leverage
tags: leverage, margin, change leverage
You can change the leverage of an account from its page under **Accounts**, choosing from the values its account type allows. Leverage can only be changed by you while the account has no open positions, and the change is confirmed with a code we email you. Higher leverage lowers the margin needed per position but increases risk.

## trading-passwords | Accounts | Trading and investor passwords, signing in to Ezymex Trader
tags: password, investor password, trading password, login, terminal, ezymex trader, mt5
Each trading account has a **trading password** (full access) and an **investor password** (read-only). Use them to sign in to Ezymex Trader at the terminal login, or open the terminal directly from any **Trade** button in the Client Area, which signs you in without a password.

To change either password, open the account under **Accounts** and choose **Change password**. We email you a confirmation code first. After too many wrong passwords the login is locked for 15 minutes.

## client-area-password | Security | Client Area password and sign-in codes
tags: forgot password, reset password, sign in, login code, new device, otp
Reset your Client Area password with **Forgot password** on the sign-in page, or **Reset password** on your Profile. We email you a code to set a new one.

When you sign in from a new device or browser, we email you a one-time code to confirm it is you. Sensitive changes (withdrawals, trading passwords, leverage, email or phone changes) also need an emailed code, even inside a signed-in session.

Ezymex will never ask you for a code, a password or your seed phrase by chat, phone or email. Never share them with anyone, including someone claiming to be from support.

## security-tips | Security | Keeping your account safe
tags: security, phishing, scam, hacked, suspicious, compromised
- Only sign in at the official Ezymex addresses. Check the address bar before typing your password.
- Never share codes we email you. Our staff will never ask for them.
- If you see a sign-in you don't recognise or you think someone has access to your account, change your Client Area password immediately and ask for a human agent in this chat so we can review your sessions.
- Use a unique password that you don't use on other sites.

## deposit-usdt | Deposits and withdrawals | Depositing USDT
tags: deposit, fund, usdt, trc20, bep20, tron, bnb chain, top up, add funds
Deposits go into your **Ezymex wallet** in USDT. Open **Wallet -> Deposit**, choose the network (**TRON / TRC20** or **BNB Chain / BEP20**) and the amount, and send exactly that amount of USDT on that network to the address shown. You can paste the transaction hash to speed up matching.

- Only send USDT on the network you selected. Tokens sent on another network or another token cannot be credited automatically.
- The deposit is credited after the required number of network confirmations, which is shown on the deposit screen. Most deposits arrive within a few minutes.
- The minimum deposit per network is shown on the deposit screen.
- Once credited, move funds to a trading account with **Wallet -> Transfer**.

## deposit-missing | Deposits and withdrawals | My deposit has not arrived
tags: deposit missing, deposit not credited, pending deposit, stuck, confirmations, transaction hash
Check **Wallet -> History**. Each deposit shows its status and the number of network confirmations.

- **Pending / confirming**: the network is still confirming the transaction. This usually takes a few minutes.
- **Review**: the deposit needs a quick manual check by our payments team (for example the amount differs from the request).
- **Unmatched**: we received funds we could not link to a request. Submit the transaction hash from the deposit page or ask a human agent here with the hash.

If a deposit on the correct network has been confirmed on the blockchain for more than 30 minutes and still isn't credited, ask to talk to a human agent and include the transaction hash.

## withdraw-usdt | Deposits and withdrawals | Withdrawing funds
tags: withdraw, withdrawal, cash out, payout, usdt, trc20, bep20, send money
Withdrawals are paid from your Ezymex wallet in USDT. First move funds from your trading account to the wallet with **Wallet -> Transfer**, then open **Wallet -> Withdraw**, choose the network, enter the address and amount, and confirm with the code we email you.

- Your identity must be verified before you can withdraw.
- A network fee and the daily limit are shown before you confirm.
- Our payments team reviews withdrawals before they are sent. You can cancel a withdrawal while it is still **requested**.
- Check the address carefully: blockchain payments cannot be reversed.

## withdrawal-status | Deposits and withdrawals | Withdrawal status and timing
tags: withdrawal pending, withdrawal delayed, withdrawal status, approved, rejected, paid, processing
A pending withdrawal is one our payments team hasn't finished processing yet. Withdrawal statuses in **Wallet -> History**:

- **Requested**: waiting for review by our payments team. You can still cancel it.
- **Approved**: approved and being sent on the blockchain.
- **Paid / completed**: sent. The transaction hash links to the blockchain explorer.
- **Rejected**: not approved; the amount is returned to your wallet balance and the reason is shown.

Most withdrawals are reviewed the same business day. If a withdrawal is taking longer than expected, ask for a human agent here; the bot can't approve or speed up withdrawals.

## wallet-transfer | Deposits and withdrawals | Moving money between the wallet and trading accounts
tags: transfer, internal transfer, move funds, wallet to account, account to wallet
Use **Wallet -> Transfer** to move money instantly between your Ezymex wallet and your own live trading accounts. You can only withdraw from an account what is not used as margin for open positions (its withdrawable amount). Transfers between different clients are not possible.

## kyc-overview | Verification (KYC) | Verifying your identity
tags: kyc, verify, verification, identity, documents, id, passport, selfie, proof of address
Verify your identity at **Profile -> Verification**. It takes a few minutes:

1. Confirm your personal details.
2. Upload an identity document (passport, national ID card or driving licence). You can use your camera with a frame guide or upload a file.
3. Upload a proof of address dated within the last 3 months (utility bill, bank statement or official letter) showing your name and address.
4. Take a selfie so we can match it to your document.

We check image quality in the browser before upload so that blurry, dark or glared photos are caught straight away. Verification is required before you can withdraw.

## kyc-review-time | Verification (KYC) | How long verification takes and what the statuses mean
tags: kyc pending, verification time, in review, more info, rejected, approved, kyc status
After you submit, our compliance team reviews your documents, usually within one business day.

- **Submitted / in review**: we are checking your documents.
- **More information needed**: we emailed you what is missing; upload it on the same page.
- **Verified**: you're done. Your name and date of birth are then locked.
- **Rejected**: the email explains why. You can usually submit new documents.

We email you when the decision is made. The bot cannot approve verification or tell you a decision before compliance makes it.

## kyc-documents | Verification (KYC) | Accepted documents and common rejection reasons
tags: accepted documents, proof of address, blurry, expired, name mismatch, document rejected
Accepted identity documents: passport, national identity card (both sides) or driving licence (both sides), valid and not expired.

Accepted proof of address: utility bill, bank or card statement, tax letter or other official letter, dated within the last 3 months, showing your full name and address. Screenshots of mobile banking are accepted only if the name, address and date are visible.

Common reasons for rejection: blurry or cropped photos, glare over the text, expired documents, a proof of address older than 3 months, or a name that doesn't match your profile. If your name changed (for example after marriage), upload a document showing the change.

## kyc-corporate | Verification (KYC) | Corporate accounts
tags: corporate, company, business account, directors, ubo, beneficial owner
Corporate clients verify the company and the people behind it: certificate of incorporation, proof of the company's address, and the identity documents of the directors and of every ultimate beneficial owner (UBO). Add them in **Profile -> Verification** after choosing a corporate account.

## profile-changes | Accounts | Changing your name, email, phone or address
tags: change name, change email, change phone, change address, personal details, date of birth
You can change your email and phone from your Profile after confirming with an emailed code. Your name and date of birth are locked once your identity is verified; to correct them, ask a human agent here and be ready to provide a document. Changing your address requires a new proof of address.

## trading-basics | Trading | Placing orders in Ezymex Trader
tags: order, market order, limit, stop, buy, sell, stop loss, take profit, trade
Ezymex Trader (the trading terminal) supports market orders and pending orders (limit, stop and stop-limit), with optional stop loss and take profit on every order. Positions can be closed fully or partially, and hedging accounts can use Close By. Pending orders can have an expiry.

Prices, charts and your positions update live. All times use server time (GMT+3, New York close rollover).

## margin-call-stop-out | Trading | Margin, margin call and stop-out
tags: margin, margin level, margin call, stop out, stopped out, liquidation, closed my position, free margin
**Margin level** = equity / used margin x 100%.

- When the margin level falls to your account type's **margin call** level, we notify you. Add funds or reduce positions to avoid a stop-out.
- If it falls to the **stop-out** level, the system automatically closes positions, starting with the largest losing one, until the margin level is back above the stop-out level.

You can see the margin call and stop-out levels of your account type on the account page. If you believe a position was closed incorrectly, ask for a human agent with the account number and position ticket so our dealing team can review the execution log.

## swaps | Fees | Swaps (overnight financing)
tags: swap, overnight, rollover, financing, swap free, islamic, triple swap
Positions held open over the daily rollover (server midnight, GMT+3) are charged or credited a swap, set per symbol for long and short positions. On Wednesdays most forex and metals symbols charge a triple swap to cover the weekend. Swap-free account types, where offered, don't charge swaps. Swap values are listed in the symbol specification in Ezymex Trader.

## fees | Fees | Spreads, commissions and wallet fees
tags: fees, spread, commission, charges, cost, withdrawal fee, deposit fee
- **Spreads**: the difference between the bid and ask prices, which depends on your account type and market conditions.
- **Commission**: some account types charge a commission per lot, shown when you open the account.
- **Swaps**: overnight financing on positions held past the rollover.
- **Deposits**: we don't charge a fee for USDT deposits; the blockchain network fee is paid by the sender.
- **Withdrawals**: a network fee is shown before you confirm a withdrawal.

There are no account maintenance fees.

## ib-programme | Partners (IB) | Partner (IB) programme
tags: ib, introducing broker, partner, referral, refer, commission, affiliate, cpa, rebate
Every Ezymex client is also a partner. Share your referral link from **Partner -> Links** (you can create campaign links to track sources). When clients you refer trade, you earn a commission per lot, across several tiers of your network, and in some programmes a CPA bonus on their first deposit.

- Your level (for example Bronze to Diamond) sets your rates and rises with active clients and monthly lots.
- Commissions are credited in batches and paid into your Ezymex wallet; see **Partner -> Commissions** and **Payouts**.
- Referred clients are linked to you permanently from sign-up.

## copy-trading | Copy trading and PAMM | Copy trading
tags: copy trading, copy, follow, master, signal, social trading, subscription
Follow a master trader from **Social -> Masters**. When you subscribe, a copy account is opened and funded from your wallet with the amount you allocate. Trades are mirrored proportionally, with your own settings: sizing mode, maximum lot, equity stop and excluded symbols.

Copied positions close when the master closes them. To stop, open **Social -> My subscriptions** and choose Stop; you can have the balance returned to your wallet. Masters charge a performance fee on new profits (high-water mark). Past performance does not guarantee future results.

## pamm | Copy trading and PAMM | PAMM funds
tags: pamm, fund, invest, investor, redeem, nav, units, lock in, rollover
In a PAMM fund a master trades one pooled account for all investors. You invest from your wallet and receive units at the fund's net asset value (NAV) at the next rollover; redemptions are also processed at a rollover. Funds can have a lock-in period and a maximum drawdown, and the master's performance fee is charged on new profits only. See **Social -> PAMM** and **My investments**.

## become-master | Copy trading and PAMM | Becoming a master trader
tags: become master, master application, strategy provider
Apply from **Social -> Become a master**. You need a verified identity, a live account with enough trading history and equity, and to set your performance fee within the broker's limits. Applications are reviewed by our team.

## prop-challenges | Prop challenges | Prop firm challenges
tags: prop, challenge, funded account, evaluation, phase, 1-step, 2-step, instant funding
Buy a challenge with wallet funds from **Prop**. Plans can be 1-step, 2-step or instant funding, with an account size, fee, leverage and rules per plan. Reach the profit target without breaking the rules (such as maximum daily loss and maximum overall drawdown, and minimum trading days) to pass each phase. After passing you receive a funded account and can request profit-split payouts to your wallet.

Rule breaches end the challenge automatically; the account's rule dashboard shows your limits live. Certificates for passed phases are under **Prop -> Certificates**.

## prop-payouts | Prop challenges | Prop payouts and failed challenges
tags: prop payout, profit split, failed challenge, breach, violation, reset
Funded accounts can request payouts of your profit share from **Prop -> Payouts**; payouts are reviewed and paid into your Ezymex wallet. If a challenge failed and you think a rule was applied incorrectly, ask for a human agent with the account number. The bot can't reverse a breach.

## academy | Platform | Ezymex Academy
tags: academy, learn, course, education, glossary, exam, certificate
Ezymex Academy has lessons from basics to advanced fundamental and technical analysis in 8 phases, with quizzes, a final exam per phase and certificates. Open it from **Academy** in the Client Area. The glossary explains trading terms.

## server-time | Platform | Server time and trading hours
tags: server time, timezone, market hours, weekend, session, closed market
Ezymex uses server time GMT+3 with the daily rollover at the New York close. Forex and metals trade from Monday to Friday; crypto trades every day; stocks follow their exchange session. Closed symbols show as closed in Ezymex Trader and pending orders wait for the market to open.

## account-closure | Accounts | Closing your account and your data
tags: close account, delete account, data export, gdpr
To close your Ezymex account or request an export of your data, ask for a human agent here. Close open positions and withdraw your balance first. We keep some records for the period the regulations require.

## contact-human | Platform | Talking to a person
tags: human, agent, person, representative, operator, talk to someone, complaint
You can ask for a human agent at any time: write "talk to a person" or use the button in the chat. The agent sees this conversation, so you won't need to repeat yourself. Complaints are always handled by our team.
