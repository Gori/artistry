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

    const enriched = await Promise.all(
      versions.map(async (version) => {
        const creator = await ctx.db.get(version.createdBy);
        return {
          ...version,
          audioUrl:
            version.audioUrl ??
            (version.audioFileId
              ? await ctx.storage.getUrl(version.audioFileId)
              : null),
          creatorName: creator?.name ?? creator?.email ?? "Unknown",
        };
      })
    );

    // Sort: current first, then newest first
    return enriched.sort((a, b) => {
      if (a.isCurrent && !b.isCurrent) return -1;
      if (!a.isCurrent && b.isCurrent) return 1;
      return b._creationTime - a._creationTime;
    });
  },
});

export const create = mutation({
  args: {
    songId: v.id("songs"),
    title: v.string(),
    audioUrl: v.string(),
    notes: v.optional(v.string()),
    category: v.optional(
      v.union(
        v.literal("demo"),
        v.literal("rough"),
        v.literal("mix"),
        v.literal("final")
      )
    ),
    duration: v.optional(v.number()),
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
      category: args.category,
      duration: args.duration,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("songVersions"),
    title: v.optional(v.string()),
    notes: v.optional(v.string()),
    category: v.optional(
      v.union(
        v.literal("demo"),
        v.literal("rough"),
        v.literal("mix"),
        v.literal("final")
      )
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const version = await ctx.db.get(args.id);
    if (!version) throw new Error("Version not found");

    const song = await ctx.db.get(version.songId);
    if (!song) throw new Error("Song not found");

    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_and_user", (q) =>
        q.eq("workspaceId", song.workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership) throw new Error("Not a member of this workspace");

    const updates: Record<string, unknown> = {};
    if (args.title !== undefined) updates.title = args.title;
    if (args.notes !== undefined) updates.notes = args.notes;
    if (args.category !== undefined) updates.category = args.category;

    await ctx.db.patch(args.id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("songVersions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const version = await ctx.db.get(args.id);
    if (!version) throw new Error("Version not found");

    const song = await ctx.db.get(version.songId);
    if (!song) throw new Error("Song not found");

    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_and_user", (q) =>
        q.eq("workspaceId", song.workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership) throw new Error("Not a member of this workspace");

    // Also delete associated markers
    const markers = await ctx.db
      .query("versionMarkers")
      .withIndex("by_version", (q) => q.eq("versionId", args.id))
      .collect();

    for (const marker of markers) {
      await ctx.db.delete(marker._id);
    }

    await ctx.db.delete(args.id);
  },
});

export const setCurrent = mutation({
  args: { id: v.id("songVersions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const version = await ctx.db.get(args.id);
    if (!version) throw new Error("Version not found");

    const song = await ctx.db.get(version.songId);
    if (!song) throw new Error("Song not found");

    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_and_user", (q) =>
        q.eq("workspaceId", song.workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership) throw new Error("Not a member of this workspace");

    // Unset current on all other versions of this song
    const allVersions = await ctx.db
      .query("songVersions")
      .withIndex("by_song", (q) => q.eq("songId", version.songId))
      .collect();

    for (const v of allVersions) {
      if (v.isCurrent) {
        await ctx.db.patch(v._id, { isCurrent: false });
      }
    }

    // Set this one as current
    await ctx.db.patch(args.id, { isCurrent: true });
  },
});
