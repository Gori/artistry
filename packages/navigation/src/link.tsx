"use client";

import { useContext, type ReactNode } from "react";
import { NavigationContext } from "./provider";

export function Link({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const nav = useContext(NavigationContext);
  if (!nav) {
    throw new Error("Link must be used within a NavigationProvider");
  }
  const Impl = nav.Link;
  return (
    <Impl href={href} className={className}>
      {children}
    </Impl>
  );
}
