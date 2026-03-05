"use client";

import { use, useEffect } from "react";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { KanbanBoard } from "@/components/kanban/board";

export default function WorkspacePage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: workspaceSlug } = use(params);
  const router = useRouter();
  const workspace = useQuery(api.workspaces.getBySlug, {
    slug: workspaceSlug,
  });

  // Update URL if workspace slug changes (e.g. name rename)
  useEffect(() => {
    if (workspace && workspace.slug && workspace.slug !== workspaceSlug) {
      router.replace(`/workspace/${workspace.slug}`);
    }
  }, [workspace, workspaceSlug, router]);

  if (workspace === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (workspace === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Workspace not found</p>
      </div>
    );
  }

  return (
    <KanbanBoard
      workspaceId={workspace._id}
      workspaceName={workspace.name}
      workspaceSlug={workspace.slug!}
    />
  );
}
