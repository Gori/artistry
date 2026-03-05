"use client";

import { useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import NextLink from "next/link";
import type { NavigationAdapter } from "@artistry/navigation";

function NextLinkAdapter({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <NextLink href={href} className={className}>
      {children}
    </NextLink>
  );
}

export function useNavigationAdapter(): NavigationAdapter {
  const router = useRouter();
  const pathname = usePathname();

  return useMemo(
    () => ({
      push: (path: string) => router.push(path),
      replace: (path: string) => router.replace(path),
      pathname,
      Link: NextLinkAdapter,
    }),
    [router, pathname]
  );
}
