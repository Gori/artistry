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

    const groups = await ctx.db
      .query("songGroups")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    return groups.sort((a, b) => a.position - b.position);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
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

    const existing = await ctx.db
      .query("songGroups")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const maxPosition =
      existing.length > 0
        ? Math.max(...existing.map((g) => g.position))
        : 0;

    return await ctx.db.insert("songGroups", {
      name: args.name,
      workspaceId: args.workspaceId,
      position: maxPosition + 1,
    });
  },
});

export const rename = mutation({
  args: {
    id: v.id("songGroups"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const group = await ctx.db.get(args.id);
    if (!group) throw new Error("Group not found");

    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_and_user", (q) =>
        q.eq("workspaceId", group.workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership) throw new Error("Not a member of this workspace");

    await ctx.db.patch(args.id, { name: args.name });
  },
});

export const remove = mutation({
  args: { id: v.id("songGroups") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const group = await ctx.db.get(args.id);
    if (!group) throw new Error("Group not found");

    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_and_user", (q) =>
        q.eq("workspaceId", group.workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership) throw new Error("Not a member of this workspace");

    // Move all songs in this group to ungrouped
    const songs = await ctx.db
      .query("songs")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", group.workspaceId))
      .collect();

    for (const song of songs) {
      if (song.groupId === args.id) {
        await ctx.db.patch(song._id, {
          groupId: undefined,
          groupPosition: undefined,
        });
      }
    }

    await ctx.db.delete(args.id);
  },
});
