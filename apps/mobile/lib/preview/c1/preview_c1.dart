// Agent C1's sample answers (Dashboard, Accounts, Wallet, Portfolio, Profile & Security, Support), one file per
// module so their work doesn't collide. Consulted before the shared answers in preview_adapter.dart.
import 'preview_accounts.dart';
import 'preview_dashboard.dart';
import 'preview_portfolio.dart';
import 'preview_profile.dart';
import 'preview_promotions.dart';
import 'preview_support.dart';
import 'preview_wallet.dart';

(int, Object)? previewC1(String method, String path, Map<String, dynamic> body, Map<String, String> query) =>
    previewAccounts(method, path, body, query) ??
    previewWallet(method, path, body, query) ??
    previewPortfolio(method, path, body, query) ??
    previewProfile(method, path, body, query) ??
    previewSupport(method, path, body, query) ??
    previewPromotions(method, path, body, query) ??
    previewDashboard(method, path, body, query);
