import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import AdminLayout from '@/components/layout/AdminLayout';

/**
 * Server-side admin route gate. Refuses to render any admin page unless
 * the `fx_admin` HttpOnly cookie is present. Backend dependencies on
 * the routes still re-verify the cookie server-side (defence in depth);
 * this gate just stops unauthenticated users from seeing an
 * empty-but-real admin chrome before being kicked.
 *
 * The cookie value isn't validated here — the gateway/admin-api do the
 * JWT verify on every authenticated request. Presence is enough to
 * decide whether to render the shell.
 */
export default async function AdminRouteGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  if (!cookieStore.get('fx_admin')) {
    redirect('/login');
  }
  return <AdminLayout>{children}</AdminLayout>;
}
