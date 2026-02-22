import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

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
      .query("audioNotes")
      .withIndex("by_song", (q) => q.eq("songId", args.songId))
      .collect();
  },
});

export const create = mutation({
  args: {
    songId: v.id("songs"),
    title: v.optional(v.string()),
    audioUrl: v.string(),
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

    const audioNoteId = await ctx.db.insert("audioNotes", {
      songId: args.songId,
      title: args.title,
      audioUrl: args.audioUrl,
      createdBy: userId,
      transcriptionStatus: "pending",
    });

    await ctx.scheduler.runAfter(0, internal.transcription.transcribe, {
      audioNoteId,
      audioUrl: args.audioUrl,
    });

    return audioNoteId;
  },
});

export const updateTranscription = internalMutation({
  args: {
    audioNoteId: v.id("audioNotes"),
    transcription: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("transcribing"),
      v.literal("transcribed"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.audioNoteId, {
      transcription: args.transcription,
      transcriptionStatus: args.status,
    });
  },
});
