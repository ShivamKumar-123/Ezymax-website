"use client";

/**
 * Client 360 controls: presence and devices, restrictions, "Log in as client". One fetch of
 * /api/admin/client-controls/users/{id} (every 15 s) shared by the header button and the cards.
 */
import * as React from "react";
import { ImpersonateButton } from "./impersonate";
import { PresenceCard, useControls } from "./presence";
import { RestrictionsCard } from "./restrictions-card";

type Ctx = { id: number; name: string; controls: ReturnType<typeof useControls> };
const ControlsContext = React.createContext<Ctx | null>(null);

export function ClientControlsProvider({ id, name, children }: { id: number; name: string; children: React.ReactNode }) {
  const controls = useControls(id);
  return <ControlsContext.Provider value={{ id, name, controls }}>{children}</ControlsContext.Provider>;
}

function useCtx() {
  const c = React.useContext(ControlsContext);
  if (!c) throw new Error("inside ClientControlsProvider only");
  return c;
}

/** Header action: "Log in as client" (Client Area or Ezymex Trader). */
export function ClientStaffActions() {
  const { id, name, controls } = useCtx();
  return <ImpersonateButton id={id} name={name} controls={controls.data} />;
}

/** Presence and devices, then restrictions (full width, the toggles in a grid). */
export function ClientControlsSection({ onChanged }: { onChanged?: () => void }) {
  const { id, name, controls } = useCtx();
  return (
    <div className="mb-4 space-y-4">
      <PresenceCard controls={controls} onChanged={controls.reload} />
      <RestrictionsCard id={id} name={name} controls={controls} onChanged={onChanged} />
    </div>
  );
}
