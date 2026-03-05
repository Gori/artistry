"use client";

import { createContext, type ReactNode } from "react";

export interface NavigationAdapter {
  push: (path: string) => void;
  replace: (path: string) => void;
  pathname: string;
  Link: React.ComponentType<{
    href: string;
    className?: string;
    children: ReactNode;
  }>;
}

export const NavigationContext = createContext<NavigationAdapter | null>(null);

export function NavigationProvider({
  adapter,
  children,
}: {
  adapter: NavigationAdapter;
  children: ReactNode;
}) {
  return (
    <NavigationContext.Provider value={adapter}>
      {children}
    </NavigationContext.Provider>
  );
}
