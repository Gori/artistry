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

    const versions = await ctx.db
      .query("songVersions")
      .withIndex("by_song", (q) => q.eq("songId", args.songId))
      .collect();

    return await Promise.all(
      versions.map(async (version) => ({
        ...version,
        audioUrl:
          version.audioUrl ??
          (version.audioFileId
            ? await ctx.storage.getUrl(version.audioFileId)
            : null),
      }))
    );
  },
});

export const create = mutation({
  args: {
    songId: v.id("songs"),
    title: v.string(),
    audioUrl: v.string(),
    notes: v.optional(v.string()),
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

    return await ctx.db.insert("songVersions", {
      songId: args.songId,
      title: args.title,
      audioUrl: args.audioUrl,
      createdBy: userId,
      notes: args.notes,
    });
  },
});
