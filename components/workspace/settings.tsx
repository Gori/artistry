"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { LogOut, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function WorkspaceSettings({
  workspaceId,
  workspaceName,
  open,
  onOpenChange,
}: {
  workspaceId: Id<"workspaces">;
  workspaceName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const members = useQuery(api.workspaces.getMembers, { workspaceId });
  const addMember = useMutation(api.workspaces.addMember);
  const updateWorkspace = useMutation(api.workspaces.update);
  const { signOut } = useAuthActions();
  const router = useRouter();

  const [name, setName] = useState(workspaceName);
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    setName(workspaceName);
  }, [workspaceName]);

  async function handleInvite() {
    if (!email.trim()) return;
    setInviting(true);
    try {
      await addMember({ workspaceId, email: email.trim(), role: "member" });
      toast.success("Member added");
      setEmail("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add member"
      );
    } finally {
      setInviting(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  const ROLE_LABELS: Record<string, string> = {
    owner: "Owner",
    admin: "Admin",
    member: "Member",
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Workspace Details</SheetTitle>
          <SheetDescription>
            Manage workspace details and members.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 p-4">
          <div>
            <Label htmlFor="workspace-name" className="mb-2 text-sm font-semibold">Name</Label>
            <Input
              id="workspace-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                if (name.trim() && name !== workspaceName) {
                  void updateWorkspace({ id: workspaceId, name: name.trim() });
                }
              }}
            />
          </div>

          <Separator />

          <div>
            <h3 className="mb-3 text-sm font-semibold">Members</h3>
            <div className="flex flex-col gap-2">
              {members?.map((member) => (
                <div
                  key={member._id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {member.user?.name ?? "Unknown"}
                    </p>
                    {member.user?.email && (
                      <p className="text-xs text-muted-foreground">
                        {member.user.email}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline">{ROLE_LABELS[member.role] ?? member.role}</Badge>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="mb-3 text-sm font-semibold">Invite Member</h3>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="invite-email" className="sr-only">
                  Email
                </Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleInvite();
                  }}
                />
              </div>
              <Button
                size="sm"
                onClick={() => void handleInvite()}
                disabled={inviting || !email.trim()}
              >
                <UserPlus />
                {inviting ? "Inviting..." : "Invite"}
              </Button>
            </div>
          </div>

          <Separator />

          <Button
            variant="outline"
            onClick={() => void handleSignOut()}
            className="w-full"
          >
            <LogOut />
            Sign Out
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
