"use client";

import { use, useEffect } from "react";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { SongDetailView } from "@/components/song/detail-view";

export default function SongDetailPage({
  params,
}: {
  params: Promise<{ workspace: string; song: string }>;
}) {
  const { workspace: workspaceSlug, song: songSlug } = use(params);
  const router = useRouter();
  const song = useQuery(api.songs.getBySlug, {
    workspaceSlug,
    songSlug,
  });

  // Update URL if song slug changes (e.g. title rename)
  useEffect(() => {
    if (song && song.slug && song.slug !== songSlug) {
      router.replace(`/workspace/${workspaceSlug}/${song.slug}`);
    }
  }, [song, songSlug, workspaceSlug, router]);

  if (song === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (song === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Song not found</p>
      </div>
    );
  }

  return (
    <SongDetailView
      song={song}
      workspaceId={song.workspaceId}
      workspaceSlug={workspaceSlug}
    />
  );
}
