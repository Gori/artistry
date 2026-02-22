import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_and_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership) return [];

    return await ctx.db
      .query("tags")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    color: v.string(),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_and_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership) throw new Error("Not a member of this workspace");

    return await ctx.db.insert("tags", {
      name: args.name,
      color: args.color,
      workspaceId: args.workspaceId,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("tags"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const tag = await ctx.db.get(args.id);
    if (!tag) throw new Error("Tag not found");

    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_and_user", (q) =>
        q.eq("workspaceId", tag.workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership) throw new Error("Not a member of this workspace");

    const updates: Record<string, string> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.color !== undefined) updates.color = args.color;

    await ctx.db.patch(args.id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("tags") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const tag = await ctx.db.get(args.id);
    if (!tag) throw new Error("Tag not found");

    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_and_user", (q) =>
        q.eq("workspaceId", tag.workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership) throw new Error("Not a member of this workspace");

    // Strip this tag from all songs that reference it
    const songs = await ctx.db
      .query("songs")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", tag.workspaceId))
      .collect();

    for (const song of songs) {
      if (song.tagIds?.includes(args.id)) {
        await ctx.db.patch(song._id, {
          tagIds: song.tagIds.filter((id) => id !== args.id),
        });
      }
    }

    await ctx.db.delete(args.id);
  },
});
