import { redirect } from 'next/navigation';

// Play Zone used to be a hub of mini-games (Spin, Lottery, Bidding). Only
// Spin & Win remains, so the hub is a redundant extra click — send users
// straight to the wheel. The sidebar/bottom-nav now link here directly too.
export default function EarnPlayZonePage() {
  redirect('/earn/play-zone/spin');
}
