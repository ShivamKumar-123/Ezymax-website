import { IS_DEMO } from "@kalks/mock/mode";
import { TradingDeskProvider } from "@/lib/trading-desk/context";

/** Every Trading page shares one dealing-desk store (positions, orders, controls, audit). Demo builds only:
 *  the desk is a localStorage simulation, so live builds never mount it (no real trades exist yet). */
export default function TradingLayout({ children }: { children: React.ReactNode }) {
  if (!IS_DEMO) return <>{children}</>;
  return <TradingDeskProvider>{children}</TradingDeskProvider>;
}
