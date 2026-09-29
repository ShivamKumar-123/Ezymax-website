import { redirect } from "next/navigation";

// Price alerts are set in the Kalks app (apps/mobile › /alerts) and their notifications link to /alerts. Opened from
// the Client Area's bell, that link goes to Markets, where the prices are.
export default function AlertsPage() {
  redirect("/markets");
}
