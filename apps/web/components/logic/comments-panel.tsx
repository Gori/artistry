"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import {
  MessageSquare,
  Loader2,
  Send,
  Trash2,
  CheckSquare,
  Square,
  Reply,
  Clock,
  FolderOpen,
  X,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatTimeAgo } from "@/lib/format-time";
import { toast } from "sonner";

function formatTimecode(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

interface CommentsPanelProps {
  versionId: Id<"logicProjectVersions">;
  songId: Id<"songs">;
}

export function CommentsPanel({ versionId, songId }: CommentsPanelProps) {
  const comments = useQuery(api.logicComments.listByVersion, { versionId });
  const createComment = useMutation(api.logicComments.create);
  const resolveComment = useMutation(api.logicComments.resolve);
  const removeComment = useMutation(api.logicComments.remove);

  const [content, setContent] = useState("");
  const [timecodeInput, setTimecodeInput] = useState("");
  const [filePath, setFilePath] = useState("");
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Id<"logicComments"> | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);

  if (comments === undefined) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Build threaded structure: top-level comments and their replies
  const topLevel = comments.filter((c) => !c.parentId);
  const repliesMap = new Map<string, typeof comments>();
  for (const c of comments) {
    if (c.parentId) {
      const existing = repliesMap.get(c.parentId) ?? [];
      existing.push(c);
      repliesMap.set(c.parentId, existing);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || submitting) return;

    setSubmitting(true);
    try {
      const timestamp = timecodeInput.trim()
        ? parseFloat(timecodeInput.trim())
        : undefined;

      await createComment({
        songId,
        versionId,
        content: content.trim(),
        parentId: replyingTo ?? undefined,
        timestamp:
          timestamp !== undefined && !isNaN(timestamp) ? timestamp : undefined,
        filePath: filePath.trim() || undefined,
      });

      setContent("");
      setTimecodeInput("");
      setFilePath("");
      setReplyingTo(null);
      setShowOptionalFields(false);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResolve(
    id: Id<"logicComments">,
    currentlyResolved: boolean | undefined
  ) {
    await resolveComment({ id, resolved: !currentlyResolved });
  }

  async function handleDelete(id: Id<"logicComments">) {
    await removeComment({ id });
  }

  type Comment = NonNullable<typeof comments>[number];

  function renderComment(
    comment: Comment,
    isReply: boolean = false
  ) {
    const replies = repliesMap.get(comment._id) ?? [];

    return (
      <div key={comment._id} className={cn(isReply && "ml-6 border-l pl-4")}>
        <div
          className={cn(
            "group rounded-md p-3 transition-colors hover:bg-accent/30",
            comment.resolved && "opacity-60"
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium text-foreground">
                {comment.creatorName}
              </span>
              <span className="text-muted-foreground">
                {formatTimeAgo(comment._creationTime)}
              </span>
              {comment.timestamp !== undefined && (
                <span className="flex items-center gap-0.5 rounded bg-accent px-1.5 py-0.5 font-mono text-muted-foreground">
                  <Clock className="size-2.5" />@{" "}
                  {formatTimecode(comment.timestamp)}
                </span>
              )}
              {comment.filePath && (
                <span className="flex items-center gap-0.5 rounded bg-accent px-1.5 py-0.5 font-mono text-muted-foreground">
                  <FolderOpen className="size-2.5" />
                  {comment.filePath}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              {!isReply && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() =>
                    setReplyingTo(
                      replyingTo === comment._id ? null : comment._id
                    )
                  }
                  title="Reply"
                >
                  <Reply className="size-3" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() =>
                  handleResolve(comment._id, comment.resolved)
                }
                title={comment.resolved ? "Unresolve" : "Resolve"}
              >
                {comment.resolved ? (
                  <CheckSquare className="size-3 text-green-500" />
                ) : (
                  <Square className="size-3" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => handleDelete(comment._id)}
                title="Delete"
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          </div>

          <p className="mt-1.5 text-sm text-foreground whitespace-pre-wrap">
            {comment.content}
          </p>

          {comment.resolved && (
            <span className="mt-1 inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <CheckSquare className="size-3" />
              Resolved
            </span>
          )}
        </div>

        {/* Replies */}
        {replies.length > 0 && (
          <div className="mt-1">
            {replies.map((reply) => renderComment(reply, true))}
          </div>
        )}

        {/* Inline reply indicator */}
        {replyingTo === comment._id && (
          <div className="ml-6 mt-1 border-l pl-4">
            <p className="text-xs text-muted-foreground">
              Replying to {comment.creatorName}...
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">
            Comments ({comments.length})
          </h3>
        </div>
        {comments.some((c) => c.resolved) && (
          <span className="text-xs text-muted-foreground">
            {comments.filter((c) => c.resolved).length} resolved
          </span>
        )}
      </div>

      {/* Comment list */}
      {topLevel.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <MessageSquare className="mx-auto mb-2 size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No comments yet. Start a conversation about this version.
          </p>
        </div>
      ) : (
        <div className="divide-y">
          {topLevel.map((comment) => renderComment(comment))}
        </div>
      )}

      {/* New comment form */}
      <div className="border-t px-4 py-3">
        {replyingTo && (
          <div className="mb-2 flex items-center justify-between rounded bg-accent/50 px-2 py-1 text-xs text-muted-foreground">
            <span>
              Replying to{" "}
              {comments.find((c) => c._id === replyingTo)?.creatorName ??
                "comment"}
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setReplyingTo(null)}
            >
              <X className="size-3" />
            </Button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-2">
          <Textarea
            placeholder="Write a comment..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[60px] resize-none text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handleSubmit(e);
              }
            }}
          />

          {showOptionalFields && (
            <div className="flex gap-2">
              <Input
                placeholder="Timecode (seconds)"
                type="number"
                step="0.1"
                min="0"
                value={timecodeInput}
                onChange={(e) => setTimecodeInput(e.target.value)}
                className="h-8 w-32 text-xs"
              />
              <Input
                placeholder="File path (optional)"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                className="h-8 flex-1 text-xs"
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setShowOptionalFields(!showOptionalFields)}
              className="text-muted-foreground"
            >
              {showOptionalFields ? "Hide options" : "Add timecode / file path"}
            </Button>

            <Button type="submit" size="sm" disabled={!content.trim() || submitting}>
              {submitting ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Send className="size-3" />
              )}
              Comment
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
