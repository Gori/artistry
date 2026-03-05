"use client";

import { use } from "react";
import { useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { SharedSongView } from "@/components/song/shared-view";

export default function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const shareData = useQuery(api.shareLinks.getByToken, { token });

  if (shareData === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (shareData === null) {
    return (
      <div className="flex min-h-screen items-center justify-center flex-col gap-4">
        <p className="text-xl font-semibold">Invalid or expired link</p>
        <p className="text-muted-foreground">
          This share link is no longer valid.
        </p>
      </div>
    );
  }

  return <SharedSongView data={shareData} />;
}
