"use client";

import { useQuery, useMutation } from "convex/react";
import { Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

export function ShareDialog({
  songId,
  open,
  onOpenChange,
}: {
  songId: Id<"songs">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const shareLinks = useQuery(api.shareLinks.listBySong, { songId });
  const createLink = useMutation(api.shareLinks.create);
  const revokeLink = useMutation(api.shareLinks.revoke);

  async function handleGenerate() {
    await createLink({ songId });
    toast.success("Share link created");
  }

  function handleCopy(token: string) {
    const url = `${window.location.origin}/share/${token}`;
    void navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");
  }

  async function handleRevoke(id: Id<"shareLinks">) {
    await revokeLink({ id });
    toast.success("Share link revoked");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share Song</DialogTitle>
          <DialogDescription>
            Create and manage share links for this song.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Button onClick={() => void handleGenerate()}>
            Generate Link
          </Button>

          {shareLinks && shareLinks.length > 0 && (
            <>
              <Separator />
              <div className="flex flex-col gap-2">
                {shareLinks.map((link) => (
                  <div
                    key={link._id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <code className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {`${typeof window !== "undefined" ? window.location.origin : ""}/share/${link.token}`}
                    </code>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleCopy(link.token)}
                      >
                        <Copy />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => void handleRevoke(link._id)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
