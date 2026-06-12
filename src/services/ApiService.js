import { API_URL } from '../config';
import * as SecureStore from 'expo-secure-store';
import { silentRelogin } from '../utils/authedFetch';
import { toMessage } from '../utils/errorMessage';

class ApiService {
  constructor() {
    this.baseUrl = API_URL;
  }

  async getAuthHeaders(tokenOverride) {
    const token = tokenOverride ?? await SecureStore.getItemAsync('token');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    };
  }

  async _attempt(endpoint, options, tokenOverride) {
    const headers = await this.getAuthHeaders(tokenOverride);
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });
    // Parse body once; many backend errors include JSON detail.
    let data;
    try { data = await response.json(); } catch (_) { data = null; }
    return { response, data };
  }

  async request(endpoint, options = {}) {
    try {
      let { response, data } = await this._attempt(endpoint, options);

      // Try silent re-login once on auth failures.
      if (response.status === 401 || response.status === 403) {
        const newToken = await silentRelogin();
        if (newToken) {
          ({ response, data } = await this._attempt(endpoint, options, newToken));
        }
      }

      if (!response.ok) {
        throw new Error(toMessage(data, `Request failed (${response.status})`));
      }

      return data;
    } catch (error) {
      console.error('API Request Error:', error);
      throw error;
    }
  }

  // Portfolio APIs
  async getPortfolioSummary(accountId = null) {
    const query = accountId ? `?account_id=${accountId}` : '';
    return this.request(`/portfolio/summary${query}`);
  }

  async getPortfolioPerformance(period = 'all') {
    return this.request(`/portfolio/performance?period=${period}`);
  }

  async getTradeHistory(accountId = null, page = 1, perPage = 50) {
    const q = new URLSearchParams({ page: String(page), per_page: String(perPage) });
    if (accountId) q.append('account_id', accountId);
    return this.request(`/portfolio/trades?${q.toString()}`);
  }

  // Wallet APIs
  async getWalletSummary() {
    return this.request('/wallet/summary');
  }

  async getDeposits(page = 1, perPage = 20) {
    return this.request(`/wallet/deposits?page=${page}&per_page=${perPage}`);
  }

  async getWithdrawals(page = 1, perPage = 20) {
    return this.request(`/wallet/withdrawals?page=${page}&per_page=${perPage}`);
  }

  async submitDeposit(data) {
    return this.request('/wallet/deposit', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async submitWithdrawal(data) {
    return this.request('/wallet/withdraw', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Wallet — extended payment gateway methods

  async getDepositBankDetails() {
    return this.request('/wallet/deposit/bank-details', { method: 'POST' });
  }

  async getRazorpayRate() {
    return this.request('/wallet/deposit/razorpay/rate');
  }

  async createRazorpayOrder(amountUsd) {
    return this.request('/wallet/deposit/razorpay/order', {
      method: 'POST',
      body: JSON.stringify({ amount_usd: amountUsd }),
    });
  }

  async verifyRazorpayPayment(data) {
    return this.request('/wallet/deposit/razorpay/verify', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async submitOnchainDeposit(data) {
    return this.request('/wallet/deposit/onchain', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getOnchainDepositStatus(depositId) {
    return this.request(`/wallet/deposit/${encodeURIComponent(depositId)}/onchain-status`);
  }

  async submitManualDeposit(formData) {
    const token = await SecureStore.getItemAsync('token');
    const res = await fetch(`${this.baseUrl}/wallet/deposit/manual`, {
      method: 'POST',
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` }),
        'Accept': 'application/json',
      },
      body: formData,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(toMessage(data, `Manual deposit failed (${res.status})`));
    return data;
  }

  async submitOnchainWithdrawal(data) {
    return this.request('/wallet/withdraw/onchain', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async submitManualWithdrawal(formData) {
    const token = await SecureStore.getItemAsync('token');
    const res = await fetch(`${this.baseUrl}/wallet/withdraw/manual`, {
      method: 'POST',
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` }),
        'Accept': 'application/json',
      },
      body: formData,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(toMessage(data, `Manual withdrawal failed (${res.status})`));
    return data;
  }

  async getOnchainWithdrawStatus(withdrawalId) {
    return this.request(`/wallet/withdraw/${encodeURIComponent(withdrawalId)}/onchain-status`);
  }

  async getTransactions({ page = 1, perPage = 50, type = null } = {}) {
    const q = new URLSearchParams({ page: String(page), per_page: String(perPage) });
    if (type) q.append('type', type);
    return this.request(`/wallet/transactions?${q.toString()}`);
  }

  // Social Trading APIs
  async getLeaderboard(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/social/leaderboard${query ? `?${query}` : ''}`);
  }

  async getMyCopies() {
    return this.request('/social/my-copies');
  }

  // Provider detail.
  async getProvider(providerId) {
    return this.request(`/social/providers/${providerId}`);
  }

  // Start copying a master. Backend takes master_id + amount (+ optional
  // account_id) as QUERY params, not a JSON body.
  async copyMaster(masterId, amount, accountId) {
    const q = new URLSearchParams({ master_id: masterId, amount: String(amount) });
    if (accountId) q.append('account_id', accountId);
    return this.request(`/social/copy?${q.toString()}`, { method: 'POST' });
  }

  // Stop an active copy allocation.
  async stopCopy(allocationId) {
    return this.request(`/social/copy/${allocationId}`, { method: 'DELETE' });
  }

  async getFollowRequests() {
    return this.request('/social/follow-requests');
  }

  async respondFollowRequest(allocationId, approve) {
    return this.request(`/social/follow-requests/${allocationId}`, {
      method: 'POST',
      body: JSON.stringify({ approve: !!approve }),
    });
  }

  async getMAMMPAMM() {
    return this.request('/social/mamm-pamm');
  }

  async investInMAMMPAMM(accountId, amount) {
    return this.request(`/social/mamm-pamm/${accountId}/invest`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  }

  async getMyProvider() {
    return this.request('/social/my-provider');
  }

  // PAMM / MAM master application.
  async getMasterEligibility() {
    return this.request('/social/masters/eligibility');
  }

  async applyAsMaster(data) {
    return this.request('/social/masters/apply', {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  }

  // Apply to become a master/provider. Config goes in the QUERY string;
  // strategy_info (optional) is the JSON body.
  // master_type: 'signal_provider' | 'pamm' | 'mam'
  async becomeProvider({
    master_type = 'signal_provider',
    performance_fee_pct,
    management_fee_pct,
    min_investment,
    max_investors,
    account_id,
    strategy_info,
  } = {}) {
    const q = new URLSearchParams({ master_type });
    if (performance_fee_pct != null) q.append('performance_fee_pct', String(performance_fee_pct));
    if (management_fee_pct != null) q.append('management_fee_pct', String(management_fee_pct));
    if (min_investment != null) q.append('min_investment', String(min_investment));
    if (max_investors != null) q.append('max_investors', String(max_investors));
    if (account_id) q.append('account_id', account_id);
    return this.request(`/social/become-provider?${q.toString()}`, {
      method: 'POST',
      body: JSON.stringify(strategy_info || {}),
    });
  }

  // Business/IB APIs
  async getBusinessStatus() {
    return this.request('/business/status');
  }

  async applyForIB() {
    return this.request('/business/apply', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async getIBDashboard() {
    return this.request('/business/ib/dashboard');
  }

  async getIBReferrals() {
    return this.request('/business/ib/referrals');
  }

  async getIBCommissions() {
    return this.request('/business/ib/commissions');
  }

  async getIBTree() {
    return this.request('/business/ib/tree');
  }

  async applyForSubBroker(data) {
    return this.request('/business/apply-sub-broker', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getSubBrokerDashboard() {
    return this.request('/business/sub-broker/dashboard');
  }

  // Profile APIs
  async getProfile() {
    return this.request('/profile');
  }

  async updateProfile(data) {
    return this.request('/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async uploadDocument(formData) {
    const token = await SecureStore.getItemAsync('token');
    const response = await fetch(`${this.baseUrl}/profile/upload-document`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(toMessage(data, 'Upload failed'));
    }
    return data;
  }

  async getDocuments() {
    return this.request('/profile/documents');
  }

  // Support APIs
  async getTickets(page = 1, perPage = 20) {
    return this.request(`/support/tickets?page=${page}&per_page=${perPage}`);
  }

  async createTicket(data) {
    return this.request('/support/tickets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getTicketDetails(ticketId) {
    return this.request(`/support/tickets/${ticketId}`);
  }

  async replyToTicket(ticketId, message) {
    return this.request(`/support/tickets/${ticketId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  // Notifications APIs
  async getNotifications(page = 1, perPage = 20) {
    return this.request(`/notifications?page=${page}&per_page=${perPage}`);
  }

  async markNotificationRead(notificationId) {
    return this.request(`/notifications/${notificationId}/read`, {
      method: 'PUT',
    });
  }

  async deleteNotification(notificationId) {
    return this.request(`/notifications/${notificationId}`, {
      method: 'DELETE',
    });
  }

  // Banners API
  async getBanners(page = 'dashboard') {
    return this.request(`/banners?page=${page}`);
  }

  // Accounts APIs
  async getAccounts() {
    return this.request('/accounts');
  }

  async createAccount(data) {
    return this.request('/accounts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getAvailableAccountGroups() {
    return this.request('/accounts/available-groups');
  }

  async openAccount(accountGroupId) {
    return this.request('/accounts/open', {
      method: 'POST',
      body: JSON.stringify({ account_group_id: accountGroupId }),
    });
  }

  async deleteAccount(accountId) {
    return this.request(`/accounts/${accountId}`, {
      method: 'DELETE',
    });
  }

  async transferInternal(fromAccountId, toAccountId, amount) {
    return this.request('/wallet/transfer-internal', {
      method: 'POST',
      body: JSON.stringify({
        from_account_id: fromAccountId,
        to_account_id: toAccountId,
        amount,
      }),
    });
  }

  // KYC API. No trailing slash — `/submit/` 307-redirects and React Native
  // drops the multipart body across the redirect ("Network request failed").
  async submitKyc(formData) {
    const token = await SecureStore.getItemAsync('token');
    const res = await fetch(`${this.baseUrl}/profile/kyc/submit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(toMessage(data, 'KYC submit failed'));
    return data;
  }

  // PAMM allocations (web format)
  async getMyAllocations() {
    return this.request('/social/my-allocations');
  }

  async withdrawAllocation(masterId) {
    return this.request(`/social/mamm-pamm/${masterId}/withdraw`, {
      method: 'DELETE',
    });
  }

  async getMasterPerformance() {
    return this.request('/social/master-performance');
  }

  async getMasterInvestors() {
    return this.request('/social/master-investors');
  }

  // Instruments APIs
  async getInstruments() {
    return this.request('/instruments');
  }

  async getAllPrices() {
    return this.request('/instruments/prices/all');
  }

  // Single-symbol live price: { symbol, bid, ask, spread }.
  async getPrice(symbol) {
    return this.request(`/instruments/${encodeURIComponent(symbol)}/price`);
  }

  async getBars(symbol, { resolution = '60', limit = 24 } = {}) {
    const query = new URLSearchParams({ resolution: String(resolution), limit: String(limit) });
    const res = await this.request(`/instruments/${encodeURIComponent(symbol)}/bars?${query.toString()}`);
    // Backend returns UDF-style { s, bars, noData } — normalise to a bars array.
    if (Array.isArray(res)) return res;
    return res?.bars || res?.items || res?.data || res?.candles || [];
  }

  // Orders APIs
  async getOrders(accountId, status = null) {
    const query = new URLSearchParams({ account_id: accountId });
    if (status) query.append('status', status);
    // Trailing slash is required — `/orders` (no slash) 307-redirects and the
    // Authorization header is dropped, returning 401.
    return this.request(`/orders/?${query.toString()}`);
  }

  async placeOrder(data) {
    // Backend requires account_id as a query param on POST /orders (it also
    // stays in the body for the order payload).
    const accountId = data?.account_id;
    const query = accountId ? `?account_id=${encodeURIComponent(accountId)}` : '';
    return this.request(`/orders/${query}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async modifyOrder(orderId, data) {
    return this.request(`/orders/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async cancelOrder(orderId) {
    return this.request(`/orders/${orderId}`, {
      method: 'DELETE',
    });
  }

  // Positions APIs
  async getPositions(accountId, status = 'open') {
    const query = new URLSearchParams({ account_id: accountId, status });
    // Trailing slash required (see getOrders) — otherwise 401 on redirect.
    return this.request(`/positions/?${query.toString()}`);
  }

  async modifyPosition(positionId, data) {
    return this.request(`/positions/${positionId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async closePosition(positionId, lots = null) {
    const body = lots ? { lots } : {};
    return this.request(`/positions/${positionId}/close`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // Account Summary API
  async getAccountSummary(accountId) {
    return this.request(`/accounts/${accountId}/summary`);
  }

  // Social Trading - TrustEdge format
  async getMasters() {
    return this.request('/social/masters');
  }

  async getMySubscriptions() {
    return this.request('/social/subscriptions');
  }

  async followMaster(data) {
    return this.request('/social/follow', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async unfollowMaster(subscriptionId) {
    return this.request(`/social/unfollow/${subscriptionId}`, {
      method: 'DELETE',
    });
  }
}

export default new ApiService();
