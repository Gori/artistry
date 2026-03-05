import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const listByVersion = query({
  args: { versionId: v.id("songVersions") },
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

    return await ctx.db
      .query("versionMarkers")
      .withIndex("by_version", (q) => q.eq("versionId", args.versionId))
      .collect();
  },
});

export const create = mutation({
  args: {
    versionId: v.id("songVersions"),
    songId: v.id("songs"),
    timestamp: v.number(),
    text: v.string(),
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

    return await ctx.db.insert("versionMarkers", {
      versionId: args.versionId,
      songId: args.songId,
      timestamp: args.timestamp,
      text: args.text,
      createdBy: userId,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("versionMarkers") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const marker = await ctx.db.get(args.id);
    if (!marker) throw new Error("Marker not found");

    const song = await ctx.db.get(marker.songId);
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
