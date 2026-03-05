import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

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

    const refs = await ctx.db
      .query("references")
      .withIndex("by_song", (q) => q.eq("songId", args.songId))
      .collect();

    return refs.sort((a, b) => a.position - b.position);
  },
});

export const create = mutation({
  args: {
    songId: v.id("songs"),
    type: v.union(
      v.literal("image"),
      v.literal("link"),
      v.literal("text"),
      v.literal("color")
    ),
    content: v.string(),
    title: v.optional(v.string()),
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

    // Get max position
    const existing = await ctx.db
      .query("references")
      .withIndex("by_song", (q) => q.eq("songId", args.songId))
      .collect();

    const maxPos =
      existing.length > 0
        ? Math.max(...existing.map((r) => r.position))
        : 0;

    return await ctx.db.insert("references", {
      songId: args.songId,
      type: args.type,
      content: args.content,
      title: args.title,
      position: maxPos + 1,
      createdBy: userId,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("references"),
    content: v.optional(v.string()),
    title: v.optional(v.string()),
    position: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const { id, ...updates } = args;
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) filtered[key] = value;
    }

    await ctx.db.patch(id, filtered);
  },
});

export const remove = mutation({
  args: { id: v.id("references") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await ctx.db.delete(args.id);
  },
});
