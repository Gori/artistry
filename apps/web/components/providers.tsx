"use client";

import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { ThemeProvider } from "next-themes";
import { ReactNode } from "react";
import { NavigationProvider } from "@artistry/navigation";
import { PlatformProvider } from "@artistry/platform";
import { useNavigationAdapter } from "@/lib/navigation-adapter";
import { webPlatformAdapter } from "@/lib/platform-adapter";
import { Toaster } from "@/components/ui/sonner";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function InnerProviders({ children }: { children: ReactNode }) {
  const navigationAdapter = useNavigationAdapter();

  return (
    <NavigationProvider adapter={navigationAdapter}>
      <PlatformProvider adapter={webPlatformAdapter}>
        {children}
        <Toaster />
      </PlatformProvider>
    </NavigationProvider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <ConvexAuthProvider client={convex}>
        <InnerProviders>{children}</InnerProviders>
      </ConvexAuthProvider>
    </ThemeProvider>
  );
}
