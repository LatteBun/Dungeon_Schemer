"use client";

import { createContext, useContext, type ReactNode } from "react";

export interface AppQuickMenuValue {
  readonly openQuickMenu: (trigger: HTMLElement) => void;
}

const AppQuickMenuContext = createContext<AppQuickMenuValue | null>(null);

export function AppQuickMenuProvider({ value, children }: {
  readonly value: AppQuickMenuValue;
  readonly children: ReactNode;
}) {
  return <AppQuickMenuContext value={value}>{children}</AppQuickMenuContext>;
}

export function useAppQuickMenu() {
  const value = useContext(AppQuickMenuContext);
  if (value === null) throw new Error("useAppQuickMenu must be used inside AppQuickMenuProvider");
  return value;
}
