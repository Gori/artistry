"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function WorkspacesPage() {
  const workspaces = useQuery(api.workspaces.list);
  const createWorkspace = useMutation(api.workspaces.create);
  const router = useRouter();
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const result = await createWorkspace({ name: name.trim() });
      setName("");
      setOpen(false);
      router.push(`/workspace/${result.slug}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Workspaces</h1>
          <p className="text-muted-foreground">
            Select a workspace or create a new one
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus />
              Create Workspace
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Workspace</DialogTitle>
              <DialogDescription>
                Give your workspace a name to get started.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="workspace-name">Name</Label>
                <Input
                  id="workspace-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Band"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleCreate();
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => void handleCreate()} disabled={creating || !name.trim()}>
                {creating ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {workspaces === undefined ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-5 w-32 rounded bg-muted" />
                <div className="h-4 w-20 rounded bg-muted" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : workspaces.length === 0 ? (
        <Card>
          <CardHeader className="text-center">
            <CardTitle>No workspaces yet</CardTitle>
            <CardDescription>
              Create your first workspace to start managing songs.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((workspace) =>
            workspace ? (
              <Card
                key={workspace._id}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => router.push(`/workspace/${workspace.slug}`)}
              >
                <CardHeader>
                  <CardTitle>{workspace.name}</CardTitle>
                </CardHeader>
              </Card>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}
