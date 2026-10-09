"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, EyeOff, UserX } from "lucide-react";
import { Card, EmptyState, PageHeader, Reveal, buttonVariants } from "@ezymex/ui";
import { ClientDetailView, ClientHeader } from "./client-detail";
import { ClientControlsProvider, ClientControlsSection, ClientStaffActions } from "@/components/clients/client-controls";
import { ClientManageMenu, type ManageResult } from "@/components/clients/manage";
import { useApi, when } from "./kit";
import type { ClientDetail } from "./types";

export function LiveClientPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = /^\d{1,18}$/.test(params.id ?? "") ? Number(params.id) : null;
  const { data, reload } = useApi<ClientDetail>(id ? `/api/admin/users/${id}` : null);
  // bumped after hide / unhide / delete so the detail cards load the new state
  const [version, setVersion] = React.useState(0);
  const back = (
    <Link href="/clients" className={buttonVariants({ variant: "surface" })}>
      <ArrowLeft /> All clients
    </Link>
  );
  if (!id)
    return (
      <Card className="mt-6">
        <EmptyState title="Client not found" text="Check the client ID and try again." illustration="magnifying_glass_tilted_left" action={back} />
      </Card>
    );
  function changed(r: ManageResult) {
    if (r === "purged") return router.push("/clients");
    reload();
    setVersion((v) => v + 1);
  }
  const u = data?.user;
  return (
    <ClientControlsProvider id={id} name={u?.name ?? `Client #${id}`}>
      <div className="pb-10">
        <PageHeader
          title="Client profile"
          subtitle={data ? `Client #${id} · ${data.user.email}` : `Client #${id}`}
          actions={
            <>
              {!u?.deleted && <ClientStaffActions />}
              {u && <ClientManageMenu client={u} onChanged={changed} variant="button" />}
              {back}
            </>
          }
        />
        {u && (u.deleted || u.hidden) && (
          <Reveal>
            <div className="mb-4 flex gap-3 rounded-[14px] border border-line bg-surface-2 px-4 py-3 text-[12.5px]" data-testid="client-state">
              <span className="mt-0.5 shrink-0 text-fg-3 [&_svg]:size-4">{u.deleted ? <UserX /> : <EyeOff />}</span>
              <div className="min-w-0 text-fg-2">
                {u.deleted ? (
                  <>
                    <span className="font-medium text-fg">Deleted on {when(u.deleted_at)}</span>
                    {u.deleted_by ? ` by ${u.deleted_by}` : ""}. Personal data was erased and the account closed; the financial records are kept for compliance.
                  </>
                ) : (
                  <>
                    <span className="font-medium text-fg">Hidden from the client lists on {when(u.hidden_at)}</span>
                    {u.hidden_by ? ` by ${u.hidden_by}` : ""}. The client can still sign in and trade.
                  </>
                )}
                {(u.deleted ? u.deleted_reason : u.hidden_reason) && <span className="block text-fg-3">Reason: {u.deleted ? u.deleted_reason : u.hidden_reason}</span>}
              </div>
            </div>
          </Reveal>
        )}
        {data && (
          <Reveal>
            <Card className="mb-4 px-6 py-5">
              <ClientHeader d={data} />
            </Card>
          </Reveal>
        )}
        {/* presence, devices and restrictions (client-controls.tsx); nothing to control on a deleted client */}
        {!u?.deleted && <ClientControlsSection />}
        <Reveal delay={0.05}>
          <ClientDetailView key={version} id={id} />
        </Reveal>
      </div>
    </ClientControlsProvider>
  );
}
