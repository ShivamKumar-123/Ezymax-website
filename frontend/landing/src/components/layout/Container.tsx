import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

export function Container({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("container-x", className)} {...props} />;
}
