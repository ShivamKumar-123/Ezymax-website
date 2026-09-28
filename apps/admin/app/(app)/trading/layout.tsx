import { TradingDeskProvider } from "@/lib/trading-desk/context";

/** Every Trading page shares one dealing-desk store (positions, orders, controls, audit). */
export default function TradingLayout({ children }: { children: React.ReactNode }) {
  return <TradingDeskProvider>{children}</TradingDeskProvider>;
}
