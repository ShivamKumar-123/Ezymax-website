import { redirect } from 'next/navigation';

// The Rewards hub was reorganized into the /earn/* routes. Old links and QR
// codes pointing here continue to work via this server-side redirect.
export default function RewardsRedirect() {
  redirect('/earn/store');
}
