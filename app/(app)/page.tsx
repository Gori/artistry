"use client";

import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { api } from "@/convex/_generated/api";

export default function AppHomePage() {
  const workspaces = useQuery(api.workspaces.list);
  const router = useRouter();

  useEffect(() => {
    if (workspaces === undefined) return;
    if (workspaces.length > 0) {
      router.replace(`/workspace/${workspaces[0]!.slug}`);
    } else {
      router.replace("/workspaces");
    }
  }, [workspaces, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
    </div>
  );
}
