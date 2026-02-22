"use client";

import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { ThemeProvider } from "next-themes";
import { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <ConvexAuthProvider client={convex}>
        {children}
        <Toaster />
      </ConvexAuthProvider>
    </ThemeProvider>
  );
}
