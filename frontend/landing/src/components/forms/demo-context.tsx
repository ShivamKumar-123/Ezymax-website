"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type DemoContextValue = {
  isOpen: boolean;
  source?: string;
  open: (source?: string) => void;
  close: () => void;
};

const DemoContext = createContext<DemoContextValue>({
  isOpen: false,
  open: () => {},
  close: () => {},
});

export function DemoProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [source, setSource] = useState<string | undefined>();

  const open = useCallback((src?: string) => {
    setSource(src);
    setIsOpen(true);
  }, []);
  const close = useCallback(() => setIsOpen(false), []);

  const value = useMemo(() => ({ isOpen, source, open, close }), [isOpen, source, open, close]);
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  return useContext(DemoContext);
}
