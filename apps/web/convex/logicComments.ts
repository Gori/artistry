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

    const comments = await ctx.db
      .query("logicComments")
      .withIndex("by_version", (q) => q.eq("versionId", args.versionId))
      .collect();

    // Batch user lookups to avoid N+1
    const uniqueCreatorIds = [...new Set(comments.map((c) => c.createdBy))];
    const creators = await Promise.all(uniqueCreatorIds.map((id) => ctx.db.get(id)));
    const creatorMap = new Map(
      uniqueCreatorIds.map((id, i) => [id, creators[i]])
    );

    const commentsWithCreators = comments.map((comment) => {
      const creator = creatorMap.get(comment.createdBy);
      return {
        ...comment,
        creatorName: creator?.name ?? creator?.email ?? "Unknown",
      };
    });

    return commentsWithCreators.sort(
      (a, b) => a._creationTime - b._creationTime
    );
  },
});

export const create = mutation({
  args: {
    songId: v.id("songs"),
    versionId: v.id("logicProjectVersions"),
    content: v.string(),
    parentId: v.optional(v.id("logicComments")),
    timestamp: v.optional(v.number()),
    filePath: v.optional(v.string()),
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

    return await ctx.db.insert("logicComments", {
      songId: args.songId,
      versionId: args.versionId,
      content: args.content,
      createdBy: userId,
      parentId: args.parentId,
      timestamp: args.timestamp,
      filePath: args.filePath,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("logicComments"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const comment = await ctx.db.get(args.id);
    if (!comment) throw new Error("Comment not found");

    if (comment.createdBy !== userId) {
      throw new Error("Only the comment creator can edit this comment");
    }

    const song = await ctx.db.get(comment.songId);
    if (!song) throw new Error("Song not found");

    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_and_user", (q) =>
        q.eq("workspaceId", song.workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership) throw new Error("Not a member of this workspace");

    await ctx.db.patch(args.id, { content: args.content });
  },
});

export const resolve = mutation({
  args: {
    id: v.id("logicComments"),
    resolved: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const comment = await ctx.db.get(args.id);
    if (!comment) throw new Error("Comment not found");

    const song = await ctx.db.get(comment.songId);
    if (!song) throw new Error("Song not found");

    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_and_user", (q) =>
        q.eq("workspaceId", song.workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership) throw new Error("Not a member of this workspace");

    await ctx.db.patch(args.id, { resolved: args.resolved ?? true });
  },
});

export const remove = mutation({
  args: { id: v.id("logicComments") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const comment = await ctx.db.get(args.id);
    if (!comment) throw new Error("Comment not found");

    if (comment.createdBy !== userId) {
      throw new Error("Only the comment creator can delete this comment");
    }

    const song = await ctx.db.get(comment.songId);
    if (!song) throw new Error("Song not found");

    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_and_user", (q) =>
        q.eq("workspaceId", song.workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership) throw new Error("Not a member of this workspace");

    await ctx.db.delete(args.id);
  },
});
