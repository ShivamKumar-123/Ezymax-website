import * as React from "react";
import type { LucideIcon, LucideProps } from "lucide-react";

/**
 * Wraps a nav icon so the icon rail shows a small "Soon" tag under it (live builds, for modules that
 * are next on the roadmap). The rail draws module icons at size-[19px] inside a positioned link; every
 * other place (mobile bar, menus, command palette) gets the plain icon.
 */
export function soonIcon(Icon: LucideIcon): LucideIcon {
  const Soon = React.forwardRef<SVGSVGElement, LucideProps>(function Soon(props, ref) {
    const icon = <Icon ref={ref} {...props} />;
    if (!String(props.className ?? "").includes("size-[19px]")) return icon;
    return (
      <>
        {icon}
        <span className="pointer-events-none absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full border border-line bg-surface-3 px-1.5 text-[8.5px] font-medium leading-[13px] text-fg-2">Soon</span>
      </>
    );
  });
  return Soon as unknown as LucideIcon;
}
