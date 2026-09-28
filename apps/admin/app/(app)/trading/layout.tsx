import { TradingDeskProvider } from "@/lib/trading-desk/context";

/** Every Trading page shares one dealing-desk store (positions, orders, controls, audit). Demo builds simulate
 *  it in localStorage; live builds load it from the trading engine and keep it current over the dealing stream. */
export default function TradingLayout({ children }: { children: React.ReactNode }) {
  return <TradingDeskProvider>{children}</TradingDeskProvider>;
}
