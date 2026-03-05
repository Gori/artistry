import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getBySong = query({
  args: { songId: v.id("songs") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const song = await ctx.db.get(args.songId);
    if (!song) return null;

    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_and_user", (q) =>
        q.eq("workspaceId", song.workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership) return null;

    return await ctx.db
      .query("notes")
      .withIndex("by_song", (q) => q.eq("songId", args.songId))
      .unique();
  },
});

export const append = mutation({
  args: {
    songId: v.id("songs"),
    content: v.string(),
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

    const existing = await ctx.db
      .query("notes")
      .withIndex("by_song", (q) => q.eq("songId", args.songId))
      .unique();

    if (existing) {
      const newContent = existing.content
        ? existing.content + "\n\n---\n\n" + args.content
        : args.content;
      await ctx.db.patch(existing._id, {
        content: newContent,
        createdBy: userId,
        updatedAt: Date.now(),
      });
      return existing._id;
    } else {
      return await ctx.db.insert("notes", {
        songId: args.songId,
        content: args.content,
        createdBy: userId,
        updatedAt: Date.now(),
      });
    }
  },
});

export const save = mutation({
  args: {
    songId: v.id("songs"),
    content: v.string(),
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

    const existing = await ctx.db
      .query("notes")
      .withIndex("by_song", (q) => q.eq("songId", args.songId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        content: args.content,
        createdBy: userId,
        updatedAt: Date.now(),
      });
      return existing._id;
    } else {
      return await ctx.db.insert("notes", {
        songId: args.songId,
        content: args.content,
        createdBy: userId,
        updatedAt: Date.now(),
      });
    }
  },
});
