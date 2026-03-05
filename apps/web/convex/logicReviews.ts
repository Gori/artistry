import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const listByVersion = query({
  args: { versionId: v.id("logicProjectVersions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const version = await ctx.db.get(args.versionId);
    if (!version) return [];

    const song = await ctx.db.get(version.songId);
    if (!song) return [];

    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_and_user", (q) =>
        q.eq("workspaceId", song.workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership) return [];

    const reviews = await ctx.db
      .query("logicReviews")
      .withIndex("by_version", (q) => q.eq("versionId", args.versionId))
      .collect();

    // Batch user lookups to avoid N+1
    const uniqueReviewerIds = [...new Set(reviews.map((r) => r.reviewerId))];
    const reviewers = await Promise.all(uniqueReviewerIds.map((id) => ctx.db.get(id)));
    const reviewerMap = new Map(
      uniqueReviewerIds.map((id, i) => [id, reviewers[i]])
    );

    return reviews.map((review) => {
      const reviewer = reviewerMap.get(review.reviewerId);
      return {
        ...review,
        reviewerName: reviewer?.name ?? reviewer?.email ?? "Unknown",
      };
    });
  },
});

export const listBySong = query({
  args: { songId: v.id("songs") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const song = await ctx.db.get(args.songId);
    if (!song) return [];

    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_and_user", (q) =>
        q.eq("workspaceId", song.workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership) return [];

    const reviews = await ctx.db
      .query("logicReviews")
      .withIndex("by_song", (q) => q.eq("songId", args.songId))
      .collect();

    // Batch user lookups to avoid N+1
    const uniqueReviewerIds = [...new Set(reviews.map((r) => r.reviewerId))];
    const reviewers = await Promise.all(uniqueReviewerIds.map((id) => ctx.db.get(id)));
    const reviewerMap = new Map(
      uniqueReviewerIds.map((id, i) => [id, reviewers[i]])
    );

    return reviews.map((review) => {
      const reviewer = reviewerMap.get(review.reviewerId);
      return {
        ...review,
        reviewerName: reviewer?.name ?? reviewer?.email ?? "Unknown",
      };
    });
  },
});

export const getByReviewer = query({
  args: { versionId: v.id("logicProjectVersions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const version = await ctx.db.get(args.versionId);
    if (!version) return null;

    const song = await ctx.db.get(version.songId);
    if (!song) return null;

    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_and_user", (q) =>
        q.eq("workspaceId", song.workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership) return null;

    const reviews = await ctx.db
      .query("logicReviews")
      .withIndex("by_version", (q) => q.eq("versionId", args.versionId))
      .collect();

    return reviews.find((r) => r.reviewerId === userId) ?? null;
  },
});

export const create = mutation({
  args: {
    songId: v.id("songs"),
    versionId: v.id("logicProjectVersions"),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("changes_requested")
    ),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const song = await ctx.db.get(args.songId);
    if (!song) throw new Error("Song not found");

    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_and_user", (q) =>
        q.eq("workspaceId", song.workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership) throw new Error("Not a member of this workspace");

    // Upsert: check if this user already has a review for this version
    const existingReviews = await ctx.db
      .query("logicReviews")
      .withIndex("by_version", (q) => q.eq("versionId", args.versionId))
      .collect();

    const existing = existingReviews.find((r) => r.reviewerId === userId);

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        comment: args.comment,
      });
      return existing._id;
    }

    return await ctx.db.insert("logicReviews", {
      songId: args.songId,
      versionId: args.versionId,
      reviewerId: userId,
      status: args.status,
      comment: args.comment,
    });
  },
});
