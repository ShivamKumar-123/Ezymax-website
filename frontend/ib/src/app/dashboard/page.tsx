import { redirect } from 'next/navigation';

// The dashboard is now the sidebar-driven portal. Keep this stub so old
// /dashboard bookmarks land on the new Overview page.
export default function DashboardRedirect() {
  redirect('/overview');
}
