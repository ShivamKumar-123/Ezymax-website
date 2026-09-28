"use client";

import Link from "next/link";
import { AppShell, Avatar, Tooltip } from "@kalks/ui";
import { NAV } from "@/lib/live";
import { AdminTopRight } from "@/components/topbar";
import { signOut, useStaff } from "@/components/staff-session";

/** The shared rail's sign-out icon is a plain link to /login; turn it into a real sign-out. */
function onRailSignOut(e: React.MouseEvent) {
  const a = (e.target as HTMLElement).closest("a");
  if (a?.getAttribute("href") === "/login") {
    e.preventDefault();
    e.stopPropagation();
    void signOut();
  }
}

/** Back Office chrome for the signed-in staff member. */
export function BackOfficeShell({ children }: { children: React.ReactNode }) {
  const staff = useStaff();
  return (
    <div className="contents" onClickCapture={onRailSignOut}>
      <AppShell
        modules={NAV}
        pillVariant="text"
        brandSuffix={<span className="hidden whitespace-nowrap rounded-md border border-line px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.14em] text-fg-2 sm:inline">BACK OFFICE</span>}
        railFooter={
          <Tooltip content={`${staff.name} · ${staff.role_label}`} side="right">
            <Link href="/org" className="mb-1">
              <Avatar name={staff.name} size={38} online />
            </Link>
          </Tooltip>
        }
        topRight={<AdminTopRight />}
      >
        {children}
      </AppShell>
    </div>
  );
}
