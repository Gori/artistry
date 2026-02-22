import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

function generateToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export const create = mutation({
  args: {
    songId: v.id("songs"),
    expiresAt: v.optional(v.number()),
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

    const token = generateToken();

    const id = await ctx.db.insert("shareLinks", {
      songId: args.songId,
      token,
      createdBy: userId,
      expiresAt: args.expiresAt,
    });

    return { id, token };
  },
});

export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const shareLink = await ctx.db
      .query("shareLinks")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();

    if (!shareLink) return null;

    if (shareLink.expiresAt && shareLink.expiresAt < Date.now()) {
      return null;
    }

    const song = await ctx.db.get(shareLink.songId);
    if (!song) return null;

    const lyrics = await ctx.db
      .query("lyrics")
      .withIndex("by_song", (q) => q.eq("songId", song._id))
      .unique();

    const versions = await ctx.db
      .query("songVersions")
      .withIndex("by_song", (q) => q.eq("songId", song._id))
      .collect();

    const audioNotes = await ctx.db
      .query("audioNotes")
      .withIndex("by_song", (q) => q.eq("songId", song._id))
      .collect();

    const tags = await Promise.all(
      (song.tagIds ?? []).map((id) => ctx.db.get(id))
    );
    const songWithTags = {
      ...song,
      tags: tags.filter((t): t is NonNullable<typeof t> => t != null),
    };

    return {
      song: songWithTags,
      lyrics,
      versions,
      audioNotes,
    };
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

    return await ctx.db
      .query("shareLinks")
      .withIndex("by_song", (q) => q.eq("songId", args.songId))
      .collect();
  },
});

export const revoke = mutation({
  args: { id: v.id("shareLinks") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const shareLink = await ctx.db.get(args.id);
    if (!shareLink) throw new Error("Share link not found");

    const song = await ctx.db.get(shareLink.songId);
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
