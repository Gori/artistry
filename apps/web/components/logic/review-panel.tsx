"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import {
  ShieldCheck,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatTimeAgo } from "@/lib/format-time";
import { toast } from "sonner";

type ReviewStatus = "pending" | "approved" | "changes_requested";

const statusConfig: Record<
  ReviewStatus,
  {
    label: string;
    badgeClass: string;
    icon: typeof CheckCircle;
  }
> = {
  approved: {
    label: "Approved",
    badgeClass:
      "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border-green-200 dark:border-green-800",
    icon: CheckCircle,
  },
  changes_requested: {
    label: "Changes Requested",
    badgeClass:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800",
    icon: AlertTriangle,
  },
  pending: {
    label: "Pending",
    badgeClass:
      "bg-muted text-muted-foreground border-border",
    icon: Clock,
  },
};

interface ReviewPanelProps {
  versionId: Id<"logicProjectVersions">;
  songId: Id<"songs">;
}

export function ReviewPanel({ versionId, songId }: ReviewPanelProps) {
  const reviews = useQuery(api.logicReviews.listByVersion, { versionId });
  const myReview = useQuery(api.logicReviews.getByReviewer, { versionId });
  const createReview = useMutation(api.logicReviews.create);

  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (reviews === undefined || myReview === undefined) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  async function handleSubmitReview(status: ReviewStatus) {
    if (submitting) return;
    setSubmitting(true);
    try {
      await createReview({
        songId,
        versionId,
        status,
        comment: comment.trim() || undefined,
      });
      setComment("");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  const approvedCount = reviews.filter((r) => r.status === "approved").length;
  const changesCount = reviews.filter(
    (r) => r.status === "changes_requested"
  ).length;

  return (
    <div className="rounded-lg border">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">
            Reviews ({reviews.length})
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {approvedCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <CheckCircle className="size-3" />
              {approvedCount} approved
            </span>
          )}
          {changesCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
              <AlertTriangle className="size-3" />
              {changesCount} changes requested
            </span>
          )}
        </div>
      </div>

      {/* Existing reviews */}
      {reviews.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <ShieldCheck className="mx-auto mb-2 size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No reviews yet. Be the first to review this version.
          </p>
        </div>
      ) : (
        <div className="divide-y">
          {reviews.map((review) => {
            const config = statusConfig[review.status as ReviewStatus];
            const StatusIcon = config.icon;

            return (
              <div
                key={review._id}
                className="flex items-start gap-3 px-4 py-3"
              >
                <StatusIcon
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    review.status === "approved" &&
                      "text-green-500",
                    review.status === "changes_requested" &&
                      "text-yellow-500",
                    review.status === "pending" &&
                      "text-muted-foreground"
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {review.reviewerName}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn("text-xs", config.badgeClass)}
                    >
                      {config.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatTimeAgo(review._creationTime)}
                    </span>
                  </div>
                  {review.comment && (
                    <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                      {review.comment}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Submit/update review */}
      <div className="border-t px-4 py-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          {myReview ? "Update your review" : "Submit your review"}
        </p>

        {myReview && (
          <p className="mb-2 text-xs text-muted-foreground">
            Your current review:{" "}
            <span className="font-medium">
              {statusConfig[myReview.status as ReviewStatus].label}
            </span>
          </p>
        )}

        <Textarea
          placeholder="Leave a comment (optional)..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="mb-3 min-h-[60px] resize-none text-sm"
        />

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSubmitReview("approved")}
            disabled={submitting}
            className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-950/30"
          >
            {submitting ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <CheckCircle className="size-3" />
            )}
            Approve
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSubmitReview("changes_requested")}
            disabled={submitting}
            className="text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 dark:text-yellow-400 dark:hover:text-yellow-300 dark:hover:bg-yellow-950/30"
          >
            {submitting ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <AlertTriangle className="size-3" />
            )}
            Request Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
