"use client";

import { useParams } from "next/navigation";
import { IS_DEMO } from "@ezymex/mock/mode";
import { ComingSoon } from "@ezymex/ui";
import { LiveTenantDetail } from "@/components/owner/tenant-detail";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return IS_DEMO ? <ComingSoon title="Tenant" text="Open a tenant from the list on live builds." /> : <LiveTenantDetail id={id} />;
}
