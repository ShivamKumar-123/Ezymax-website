"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Activity, Lock, ShieldCheck } from "lucide-react";
import { Logo, Starfield, ThemeToggle } from "@kalks/ui";

function StatusCard({ icon, title, sub, className }: { icon: React.ReactNode; title: string; sub: string; className?: string }) {
  return (
    <div className={className}>
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/50 px-4 py-3 backdrop-blur-xl">
        <span className="grid size-9 place-items-center rounded-full border border-white/10 bg-white/5 text-white/80 [&_svg]:size-4">{icon}</span>
        <div>
          <div className="text-[13px] font-medium text-white">{title}</div>
          <div className="text-[11.5px] text-white/55">{sub}</div>
        </div>
      </div>
    </div>
  );
}

export default function AdminAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/photos/skyscrapers.jpg" alt="" className="absolute inset-0 size-full scale-105 object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,7,10,0.72),rgba(7,7,10,0.55)_40%,rgba(7,7,10,0.97))]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_520px_at_15%_-10%,rgba(255,90,31,0.5),transparent_60%)] mix-blend-screen" />
        <div className="absolute inset-0 bg-[radial-gradient(600px_400px_at_90%_110%,rgba(255,120,50,0.18),transparent_70%)]" />
        <Starfield density={45} />
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <Logo height={26} className="text-white" />
            <span className="rounded-md border border-white/20 px-2 py-0.5 text-[11px] font-semibold tracking-[0.18em] text-white/80">BACK OFFICE</span>
          </div>
          <div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-9 flex flex-col gap-3">
              <StatusCard icon={<Activity />} title="All systems operational" sub="14 services · p99 gateway 18ms" className="self-start" />
              <StatusCard icon={<ShieldCheck />} title="Every action is audited" sub="Reason codes · immutable log · GMT+3" className="ml-16 self-start" />
              <StatusCard icon={<Lock />} title="Device-bound staff access" sub="Email OTP on every new device" className="ml-6 self-start" />
            </motion.div>
            <h2 className="max-w-md text-[40px] font-medium leading-[1.08] tracking-[-0.03em] text-white">Run the whole brokerage from one console.</h2>
            <p className="mt-4 max-w-md text-[15px] text-white/70">Dealing, risk, compliance, finance and partners — live exposure, queues and alerts for Kalks Markets and every white-label tenant.</p>
            <p className="mt-10 max-w-lg text-[11px] leading-relaxed text-white/45">
              Authorised staff only. Access is logged and monitored. Unauthorised use of this system is prohibited and may be subject to criminal and civil penalties.
            </p>
          </div>
        </div>
      </div>

      <div className="relative flex flex-col overflow-hidden">
        <div className="k-glow opacity-60" />
        <div className="relative flex items-center justify-between p-6">
          <div className="flex items-center gap-2.5 lg:invisible">
            <Logo height={20} />
            <span className="rounded-md border border-line px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.14em] text-fg-2">BACK OFFICE</span>
          </div>
          <ThemeToggle />
        </div>
        <div className="relative flex flex-1 items-center justify-center px-6 pb-12">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="w-full max-w-[420px]">
            {children}
          </motion.div>
        </div>
        <div className="relative px-6 pb-6 text-center text-[11.5px] text-fg-3">Kalks Markets · Staff console v2.14 · Server time GMT+3</div>
      </div>
    </div>
  );
}
