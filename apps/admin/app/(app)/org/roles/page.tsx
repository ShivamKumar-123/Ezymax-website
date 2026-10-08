"use client";

import { IS_DEMO } from "@ezymex/mock/mode";
import { LiveRoles } from "@/components/rbac/roles";

import { toast } from "sonner";
import { History, ShieldCheck } from "lucide-react";
import { Button, PageHeader } from "@ezymex/ui";
import { PermissionBuilder } from "@/components/org/permission-builder";

function RolesPage() {
  return (
    <div className="pb-16">
      <PageHeader
        title="Roles & permissions"
        subtitle="Granular per-module access · view, create, edit, approve, export · changes are versioned and audited"
        actions={
          <>
            <Button variant="surface" onClick={() => toast.info("Permission history", { description: "Risk role edited by Priya Nair on 19 Sep · 3 changes" })}>
              <History /> History
            </Button>
            <Button variant="surface" onClick={() => toast.success("Access review scheduled", { description: "Quarterly review sent to 9 desk leads · due 1 Oct" })}>
              <ShieldCheck /> Start access review
            </Button>
          </>
        }
      />
      {/* not wrapped in Reveal: the fixed save bar must not sit inside a transformed ancestor */}
      <PermissionBuilder />
    </div>
  );
}

export default function Page() {
  return IS_DEMO ? <RolesPage /> : <LiveRoles />;
}
