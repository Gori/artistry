"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { Download, Loader2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatBytes } from "@artistry/ui";

interface DownloadDialogProps {
  versionId: Id<"logicProjectVersions">;
  versionNumber: number;
}

export function DownloadDialog({
  versionId,
  versionNumber,
}: DownloadDialogProps) {
  const [open, setOpen] = useState(false);
  const downloadUrls = useQuery(
    api.logicProjectVersions.getDownloadUrls,
    open ? { versionId } : "skip"
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="xs" variant="ghost">
          <Download className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Download v{versionNumber}</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          {!downloadUrls ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {downloadUrls.songTitle} v{downloadUrls.versionNumber}{" "}
                &mdash; {downloadUrls.entries.length} files
              </p>
              <p className="text-sm text-muted-foreground">
                Use the Artistry desktop app to pull this version directly to
                your local machine, preserving the .logicx bundle structure.
              </p>
              <div className="max-h-60 overflow-y-auto rounded border">
                <div className="divide-y">
                  {downloadUrls.entries.map((entry, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-3 py-1.5 text-xs"
                    >
                      <span className="min-w-0 truncate font-mono">
                        {entry.path}
                      </span>
                      <span className="ml-2 shrink-0 text-muted-foreground">
                        {formatBytes(entry.size)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
