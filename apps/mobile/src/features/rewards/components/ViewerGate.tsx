// Rewards are never part of a view-only login's shared access (apps/crm/lib/viewer.ts: no section covers the growth
// BFF), and the server refuses every rewards request of one. A rewards screen opened by a view-only login (a link, a
// notification) says so at once instead of loading into refusals; read-only staff sessions still see rewards.
import * as React from "react";
import { useT, type MessageKey } from "@/i18n";
import type { ApiError } from "@/lib/api";
import { useViewer } from "@/features/partner/api";
import { Page, StackBar, useScrollY } from "../../partner/components/Chrome";
import { ScreenState } from "../../partner/components/States";

const VIEWER_SCOPE: ApiError = { code: "viewer_scope", message: "", status: 403 };
const noop = () => {};

function Blocked({ title }: { title: MessageKey }) {
  const t = useT();
  const { scrollY } = useScrollY();
  return (
    <Page bar={<StackBar title={t(title)} scrollY={scrollY} />}>
      <ScreenState ns="mobileRewards" error={VIEWER_SCOPE} onRetry={noop} />
    </Page>
  );
}

/** Wraps a rewards screen: a view-only login gets the "not shared" state, everyone else the screen. */
export function viewerGated(Screen: React.ComponentType, title: MessageKey) {
  function Gated() {
    const viewer = useViewer();
    return viewer ? <Blocked title={title} /> : <Screen />;
  }
  Gated.displayName = `ViewerGated(${Screen.displayName ?? Screen.name ?? "Screen"})`;
  return Gated;
}
