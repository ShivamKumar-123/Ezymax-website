"use client";

import { LivePaymentMethodsPage } from "@/components/finance-live/payment-methods";

/** Payment methods: the broker's bank / UPI accounts and crypto addresses for manual deposits.
 *  Live builds read the wallet service; demo builds run the same page on mock data (components/finance-live/manual-data.ts). */
export default function PaymentMethodsPage() {
  return <LivePaymentMethodsPage />;
}
