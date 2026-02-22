import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { generateUniqueSlug } from "./lib/slugify";

const RESERVED_SLUGS = new Set(["workspace", "workspaces", "login", "share"]);

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const slug = await generateUniqueSlug(args.name, async (candidate) => {
      if (RESERVED_SLUGS.has(candidate)) return true;
      const existing = await ctx.db
        .query("workspaces")
        .withIndex("by_slug", (q) => q.eq("slug", candidate))
        .first();
      return existing !== null;
    });

    const workspaceId = await ctx.db.insert("workspaces", {
      name: args.name,
      slug,
      createdBy: userId,
    });

    await ctx.db.insert("workspaceMembers", {
      workspaceId,
      userId,
      role: "owner",
    });

    return { id: workspaceId, slug };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const memberships = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const workspaces = await Promise.all(
      memberships.map(async (m) => {
        const workspace = await ctx.db.get(m.workspaceId);
        return workspace;
      })
    );

    return workspaces.filter(Boolean);
  },
});

export const get = query({
  args: { id: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_and_user", (q) =>
        q.eq("workspaceId", args.id).eq("userId", userId)
      )
      .unique();

    if (!membership) throw new Error("Not a member of this workspace");

    return await ctx.db.get(args.id);
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const workspace = await ctx.db
      .query("workspaces")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!workspace) return null;

    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_and_user", (q) =>
        q.eq("workspaceId", workspace._id).eq("userId", userId)
      )
      .unique();

    if (!membership) throw new Error("Not a member of this workspace");

    return workspace;
  },
});

export const update = mutation({
  args: {
    id: v.id("workspaces"),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_and_user", (q) =>
        q.eq("workspaceId", args.id).eq("userId", userId)
      )
      .unique();

    if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
      throw new Error("Not authorized to update workspace");
    }

    const workspace = await ctx.db.get(args.id);
    if (!workspace) throw new Error("Workspace not found");

    const updates: Record<string, unknown> = {};

    if (args.name && args.name !== workspace.name) {
      updates.name = args.name;
      updates.slug = await generateUniqueSlug(args.name, async (candidate) => {
        if (RESERVED_SLUGS.has(candidate)) return true;
        const existing = await ctx.db
          .query("workspaces")
          .withIndex("by_slug", (q) => q.eq("slug", candidate))
          .first();
        return existing !== null && existing._id !== args.id;
      });
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.id, updates);
    }

    return { slug: (updates.slug as string | undefined) ?? workspace.slug };
  },
});

export const addMember = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("member")),
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

    if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
      throw new Error("Not authorized to add members");
    }

    const users = await ctx.db.query("users").collect();
    const targetUser = users.find((u) => u.email === args.email);
    if (!targetUser) throw new Error("User not found");

    const existing = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_and_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", targetUser._id)
      )
      .unique();

    if (existing) throw new Error("User is already a member");

    await ctx.db.insert("workspaceMembers", {
      workspaceId: args.workspaceId,
      userId: targetUser._id,
      role: args.role,
    });
  },
});

export const getMembers = query({
  args: { workspaceId: v.id("workspaces") },
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

    const members = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    return await Promise.all(
      members.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        return {
          _id: m._id,
          role: m.role,
          user: user
            ? { _id: user._id, name: user.name, email: user.email, image: user.image }
            : null,
        };
      })
    );
  },
});
