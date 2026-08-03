"use client";

import { useEffect } from "react";

import { useUi } from "@/lib/ui-store";

/**
 * Releases the `ready` reveal gate on mount. Every above-the-fold reveal waits
 * on `ready`, but only the home intro film flips it — a page that renders
 * without `IntroVideo` mounts this instead, or its header never appears.
 */
export const MarkReady = () => {
  const setReady = useUi((state) => state.setReady);

  useEffect(() => {
    setReady();
  }, [setReady]);

  return null;
};
