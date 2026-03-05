import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const register = mutation({
  args: {
    sha256: v.string(),
    url: v.string(),
    size: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check if blob already exists (content-addressed dedup)
    const existing = await ctx.db
      .query("logicBlobs")
      .withIndex("by_sha256", (q) => q.eq("sha256", args.sha256))
      .first();

    if (existing) {
      return existing._id;
    }

    const id = await ctx.db.insert("logicBlobs", {
      sha256: args.sha256,
      url: args.url,
      size: args.size,
      registeredBy: userId,
    });

    return id;
  },
});

export const checkExisting = query({
  args: {
    hashes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = new Set<string>();
    for (const hash of args.hashes) {
      const blob = await ctx.db
        .query("logicBlobs")
        .withIndex("by_sha256", (q) => q.eq("sha256", hash))
        .first();
      if (blob) {
        existing.add(hash);
      }
    }

    return {
      existing: Array.from(existing),
      missing: args.hashes.filter((h) => !existing.has(h)),
    };
  },
});

export const getByHash = query({
  args: { sha256: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db
      .query("logicBlobs")
      .withIndex("by_sha256", (q) => q.eq("sha256", args.sha256))
      .first();
  },
});

export const getBatchByHash = query({
  args: { hashes: v.array(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const results: Record<string, { url: string; size: number }> = {};
    for (const hash of args.hashes) {
      const blob = await ctx.db
        .query("logicBlobs")
        .withIndex("by_sha256", (q) => q.eq("sha256", hash))
        .first();
      if (blob) {
        results[hash] = { url: blob.url, size: blob.size };
      }
    }

    return results;
  },
});
