import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getByVersions = query({
  args: {
    fromVersionId: v.id("logicProjectVersions"),
    toVersionId: v.id("logicProjectVersions"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const diff = await ctx.db
      .query("logicDiffs")
      .withIndex("by_versions", (q) =>
        q
          .eq("fromVersionId", args.fromVersionId)
          .eq("toVersionId", args.toVersionId)
      )
      .first();

    return diff;
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
      .query("logicDiffs")
      .withIndex("by_song", (q) => q.eq("songId", args.songId))
      .collect();
  },
});
