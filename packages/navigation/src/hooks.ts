"use client";

import { useContext, useMemo } from "react";
import { NavigationContext } from "./provider";

function useNavigation() {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    throw new Error(
      "useAppRouter/useAppPathname must be used within a NavigationProvider"
    );
  }
  return ctx;
}

export function useAppRouter() {
  const nav = useNavigation();
  return useMemo(() => ({ push: nav.push, replace: nav.replace }), [nav]);
}

export function useAppPathname() {
  return useNavigation().pathname;
}
