"use client";

import { createContext, useContext, type PropsWithChildren } from "react";

export interface AppQuickMenuValue {
  readonly openQuickMenu: (trigger: HTMLElement) => void;
}

const AppQuickMenuContext = createContext<AppQuickMenuValue | null>(null);

export function AppQuickMenuProvider({ value, children }: PropsWithChildren<{
  readonly value: AppQuickMenuValue;
}>) {
  return <AppQuickMenuContext value={value}>{children}</AppQuickMenuContext>;
}

export function useAppQuickMenu() {
  const value = useContext(AppQuickMenuContext);
  if (value === null) throw new Error("useAppQuickMenu must be used inside AppQuickMenuProvider");
  return value;
}
