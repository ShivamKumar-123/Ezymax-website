"use client";

import * as React from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Link2, ShieldCheck } from "lucide-react";
import { Button, Card, Chip, CopyButton, Icon3D, Starfield, shortHash } from "@ezymex/ui";
import { SEC_AUDIT, SEC_CHAIN_HEAD, SEC_CHAIN_VERIFIED_AT } from "@ezymex/mock/admin-platform-security";
import { ago, timeGmt3 } from "./shared";

/** Hero card: tamper-evident, hash-chained ledger with a mini block chain. */
export function ChainCard() {
  const [verifying, setVerifying] = React.useState(false);
  const blocks = SEC_AUDIT.slice(0, 4).reverse();
  const verify = () => {
    setVerifying(true);
    toast.promise(new Promise((r) => setTimeout(r, 1400)), {
      loading: "Re-computing SHA-256 chain…",
      success: () => {
        setVerifying(false);
        return { message: "Chain intact", description: "1,284,336 entries verified · no gaps · head matches WORM archive" };
      },
      error: "Verification failed",
    });
  };
  return (
    <Card hot className="overflow-hidden">
      <Starfield density={36} />
      <div className="relative px-5 pb-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Chip tone="up" dot>
              Immutable · hash-chained
            </Chip>
            <h3 className="mt-3 text-[17px] font-medium tracking-tight">Tamper-evident ledger</h3>
            <p className="mt-1 text-[12.5px] leading-snug text-fg-2">Append-only. Each entry embeds the SHA-256 of the previous one and is mirrored to WORM storage.</p>
          </div>
          <Icon3D name="locked" size={56} className="-mr-1 -mt-1 shrink-0" />
        </div>

        <div className="mt-4 rounded-[14px] border border-white/10 bg-black/30 px-3.5 py-3">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-fg-3">
            <span>Chain head</span>
            <CopyButton value={SEC_CHAIN_HEAD} label="Chain head hash" className="size-5" />
          </div>
          <div className="mt-1 break-all font-mono text-[11.5px] leading-[17px] text-ember">{SEC_CHAIN_HEAD}</div>
        </div>

        {/* mini chain */}
        <div className="mt-4 flex items-center">
          {blocks.map((b, i) => (
            <React.Fragment key={b.id}>
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.08 }}
                className="min-w-0 flex-1 rounded-[10px] border border-white/10 bg-black/25 px-2 py-1.5 text-center"
              >
                <div className="k-num font-mono text-[10px] text-fg-3">#{String(b.seq).slice(-3)}</div>
                <div className="truncate font-mono text-[10.5px] text-fg-2">{b.hash.slice(0, 6)}</div>
              </motion.div>
              {i < blocks.length - 1 && (
                <span className="relative mx-0.5 h-px w-3 shrink-0 bg-ember/50">
                  <motion.span
                    className="absolute -top-[2px] size-[5px] rounded-full bg-ember shadow-[0_0_8px_var(--k-ember)]"
                    animate={{ left: ["-2px", "10px"] }}
                    transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.4, ease: "easeInOut" }}
                  />
                </span>
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="text-[11.5px] text-fg-3">
            <span className="flex items-center gap-1.5 text-up">
              <ShieldCheck className="size-3.5" /> Verified {ago(SEC_CHAIN_VERIFIED_AT)}
            </span>
            <span className="mt-0.5 block">
              Last check <span className="font-mono">{timeGmt3(SEC_CHAIN_VERIFIED_AT, false)}</span> · every 10 min
            </span>
          </div>
          <Button size="sm" variant="ember" onClick={verify} disabled={verifying}>
            <Link2 /> {verifying ? "Verifying…" : "Verify now"}
          </Button>
        </div>
        <div className="mt-3 text-[11px] text-fg-3">Head {shortHash(SEC_CHAIN_HEAD, 8, 6)} anchored hourly to the regulator archive.</div>
      </div>
    </Card>
  );
}
