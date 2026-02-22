import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { generateUniqueSlug } from "./lib/slugify";

export const listByWorkspace = query({
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

    const songs = await ctx.db
      .query("songs")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const allTags = await ctx.db
      .query("tags")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const tagMap = new Map(allTags.map((t) => [t._id, t]));

    const songsWithTags = songs.map((song) => ({
      ...song,
      tags: (song.tagIds ?? [])
        .map((id) => tagMap.get(id))
        .filter((t): t is NonNullable<typeof t> => t != null),
    }));

    return songsWithTags.sort((a, b) => a.position - b.position);
  },
});

export const create = mutation({
  args: {
    title: v.string(),
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

    const existingSongs = await ctx.db
      .query("songs")
      .withIndex("by_workspace_and_stage", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("stage", "idea")
      )
      .collect();

    const maxPosition =
      existingSongs.length > 0
        ? Math.max(...existingSongs.map((s) => s.position))
        : 0;

    const slug = await generateUniqueSlug(args.title, async (candidate) => {
      const existing = await ctx.db
        .query("songs")
        .withIndex("by_workspace_and_slug", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("slug", candidate)
        )
        .first();
      return existing !== null;
    });

    const id = await ctx.db.insert("songs", {
      title: args.title,
      slug,
      workspaceId: args.workspaceId,
      stage: "idea",
      position: maxPosition + 1,
      createdBy: userId,
    });

    return { id, slug };
  },
});

export const get = query({
  args: { id: v.id("songs") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const song = await ctx.db.get(args.id);
    if (!song) return null;

    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_and_user", (q) =>
        q.eq("workspaceId", song.workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership) throw new Error("Not a member of this workspace");

    const tags = await Promise.all(
      (song.tagIds ?? []).map((id) => ctx.db.get(id))
    );

    return {
      ...song,
      tags: tags.filter((t): t is NonNullable<typeof t> => t != null),
    };
  },
});

export const getBySlug = query({
  args: { workspaceSlug: v.string(), songSlug: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const workspace = await ctx.db
      .query("workspaces")
      .withIndex("by_slug", (q) => q.eq("slug", args.workspaceSlug))
      .first();

    if (!workspace) return null;

    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_and_user", (q) =>
        q.eq("workspaceId", workspace._id).eq("userId", userId)
      )
      .unique();

    if (!membership) throw new Error("Not a member of this workspace");

    const song = await ctx.db
      .query("songs")
      .withIndex("by_workspace_and_slug", (q) =>
        q.eq("workspaceId", workspace._id).eq("slug", args.songSlug)
      )
      .first();

    if (!song) return null;

    const tags = await Promise.all(
      (song.tagIds ?? []).map((id) => ctx.db.get(id))
    );

    return {
      ...song,
      workspaceName: workspace.name,
      tags: tags.filter((t): t is NonNullable<typeof t> => t != null),
    };
  },
});

export const update = mutation({
  args: {
    id: v.id("songs"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    tempo: v.optional(v.string()),
    key: v.optional(v.string()),
    tagIds: v.optional(v.array(v.id("tags"))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const song = await ctx.db.get(args.id);
    if (!song) throw new Error("Song not found");

    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_and_user", (q) =>
        q.eq("workspaceId", song.workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership) throw new Error("Not a member of this workspace");

    const { id, ...updates } = args;
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        filtered[key] = value;
      }
    }

    // Regenerate slug when title changes
    if (args.title && args.title !== song.title) {
      const slug = await generateUniqueSlug(args.title, async (candidate) => {
        const existing = await ctx.db
          .query("songs")
          .withIndex("by_workspace_and_slug", (q) =>
            q.eq("workspaceId", song.workspaceId).eq("slug", candidate)
          )
          .first();
        return existing !== null && existing._id !== id;
      });
      filtered.slug = slug;
    }

    await ctx.db.patch(id, filtered);

    return { slug: (filtered.slug as string | undefined) ?? song.slug };
  },
});

export const move = mutation({
  args: {
    id: v.id("songs"),
    stage: v.union(
      v.literal("idea"),
      v.literal("writing"),
      v.literal("producing"),
      v.literal("mixing"),
      v.literal("done")
    ),
    position: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const song = await ctx.db.get(args.id);
    if (!song) throw new Error("Song not found");

    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_and_user", (q) =>
        q.eq("workspaceId", song.workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership) throw new Error("Not a member of this workspace");

    await ctx.db.patch(args.id, {
      stage: args.stage,
      position: args.position,
    });
  },
});

export const importNew = mutation({
  args: {
    title: v.string(),
    workspaceId: v.id("workspaces"),
    content: v.string(),
    target: v.union(v.literal("lyrics"), v.literal("notes")),
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

    const existingSongs = await ctx.db
      .query("songs")
      .withIndex("by_workspace_and_stage", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("stage", "idea")
      )
      .collect();

    const maxPosition =
      existingSongs.length > 0
        ? Math.max(...existingSongs.map((s) => s.position))
        : 0;

    const slug = await generateUniqueSlug(args.title, async (candidate) => {
      const existing = await ctx.db
        .query("songs")
        .withIndex("by_workspace_and_slug", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("slug", candidate)
        )
        .first();
      return existing !== null;
    });

    const id = await ctx.db.insert("songs", {
      title: args.title,
      slug,
      workspaceId: args.workspaceId,
      stage: "idea",
      position: maxPosition + 1,
      createdBy: userId,
    });

    if (args.target === "lyrics") {
      await ctx.db.insert("lyrics", {
        songId: id,
        content: args.content,
        updatedBy: userId,
      });
    } else {
      await ctx.db.insert("notes", {
        songId: id,
        content: args.content,
        createdBy: userId,
        updatedAt: Date.now(),
      });
    }

    return { id, slug };
  },
});

export const remove = mutation({
  args: { id: v.id("songs") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const song = await ctx.db.get(args.id);
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
