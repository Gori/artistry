import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

const manifestEntryValidator = v.object({
  path: v.string(),
  sha256: v.string(),
  size: v.number(),
  mtime: v.number(),
});

export const initiateUpload = mutation({
  args: {
    songId: v.id("songs"),
    message: v.optional(v.string()),
    manifest: v.array(manifestEntryValidator),
    totalSize: v.number(),
    fileCount: v.number(),
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

    // Determine next version number
    const versionNumber = (song.latestLogicVersionNumber ?? 0) + 1;

    // Create version record in "uploading" state
    const versionId = await ctx.db.insert("logicProjectVersions", {
      songId: args.songId,
      versionNumber,
      message: args.message,
      createdBy: userId,
      status: "uploading",
      manifest: args.manifest,
      totalSize: args.totalSize,
      fileCount: args.fileCount,
    });

    // Check which blobs already exist
    const allHashes = args.manifest.map((e) => e.sha256);
    const uniqueHashes = [...new Set(allHashes)];

    const existingHashes = new Set<string>();
    for (const hash of uniqueHashes) {
      const blob = await ctx.db
        .query("logicBlobs")
        .withIndex("by_sha256", (q) => q.eq("sha256", hash))
        .first();
      if (blob) {
        existingHashes.add(hash);
      }
    }

    const missingHashes = uniqueHashes.filter((h) => !existingHashes.has(h));

    return {
      versionId,
      versionNumber,
      missingHashes,
      existingCount: existingHashes.size,
      totalUniqueFiles: uniqueHashes.length,
    };
  },
});

export const completeUpload = mutation({
  args: {
    versionId: v.id("logicProjectVersions"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const version = await ctx.db.get(args.versionId);
    if (!version) throw new Error("Version not found");

    if (version.status !== "uploading") {
      throw new Error(`Version is in '${version.status}' state, expected 'uploading'`);
    }

    const song = await ctx.db.get(version.songId);
    if (!song) throw new Error("Song not found");

    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_and_user", (q) =>
        q.eq("workspaceId", song.workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership) throw new Error("Not a member of this workspace");

    // Verify all manifest blobs exist
    const allHashes = [...new Set(version.manifest.map((e) => e.sha256))];
    for (const hash of allHashes) {
      const blob = await ctx.db
        .query("logicBlobs")
        .withIndex("by_sha256", (q) => q.eq("sha256", hash))
        .first();
      if (!blob) {
        throw new Error(`Missing blob for hash: ${hash.substring(0, 16)}...`);
      }
    }

    // Move to processing state
    await ctx.db.patch(args.versionId, { status: "processing" });

    // Update song's latest logic version
    await ctx.db.patch(version.songId, {
      latestLogicVersionId: args.versionId,
      latestLogicVersionNumber: version.versionNumber,
    });

    // Schedule diff computation if there's a previous version
    if (version.versionNumber > 1) {
      const prevVersion = await ctx.db
        .query("logicProjectVersions")
        .withIndex("by_song_and_version", (q) =>
          q
            .eq("songId", version.songId)
            .eq("versionNumber", version.versionNumber - 1)
        )
        .first();

      if (prevVersion) {
        // Create processing job for diff
        await ctx.db.insert("logicProcessingJobs", {
          versionId: args.versionId,
          songId: version.songId,
          type: "diff",
          status: "pending",
        });

        // Schedule the diff computation
        await ctx.scheduler.runAfter(0, internal.logicProcessing.computeDiff, {
          songId: version.songId,
          fromVersionId: prevVersion._id,
          toVersionId: args.versionId,
        });
      }
    }

    // If no diff needed, mark as ready immediately
    if (version.versionNumber === 1) {
      await ctx.db.patch(args.versionId, { status: "ready" });
    }

    return { versionNumber: version.versionNumber };
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

    const versions = await ctx.db
      .query("logicProjectVersions")
      .withIndex("by_song", (q) => q.eq("songId", args.songId))
      .collect();

    const versionsWithCreators = await Promise.all(
      versions.map(async (version) => {
        const creator = await ctx.db.get(version.createdBy);
        return {
          ...version,
          creatorName: creator?.name ?? creator?.email ?? "Unknown",
        };
      })
    );

    return versionsWithCreators.sort(
      (a, b) => b.versionNumber - a.versionNumber
    );
  },
});

export const get = query({
  args: { id: v.id("logicProjectVersions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const version = await ctx.db.get(args.id);
    if (!version) return null;

    const song = await ctx.db.get(version.songId);
    if (!song) return null;

    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_and_user", (q) =>
        q.eq("workspaceId", song.workspaceId).eq("userId", userId)
      )
      .unique();

    if (!membership) throw new Error("Not a member of this workspace");

    const creator = await ctx.db.get(version.createdBy);
    return {
      ...version,
      creatorName: creator?.name ?? creator?.email ?? "Unknown",
    };
  },
});

export const getDownloadUrls = query({
  args: { versionId: v.id("logicProjectVersions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const version = await ctx.db.get(args.versionId);
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

    // Resolve manifest entries to download URLs
    const entries: { path: string; url: string; size: number }[] = [];
    for (const entry of version.manifest) {
      const blob = await ctx.db
        .query("logicBlobs")
        .withIndex("by_sha256", (q) => q.eq("sha256", entry.sha256))
        .first();
      if (blob) {
        entries.push({
          path: entry.path,
          url: blob.url,
          size: entry.size,
        });
      }
    }

    return {
      songTitle: song.title,
      versionNumber: version.versionNumber,
      entries,
    };
  },
});

// Internal mutation for marking version as ready after processing
export const markReady = internalMutation({
  args: { versionId: v.id("logicProjectVersions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.versionId, { status: "ready" });
  },
});

export const markError = internalMutation({
  args: {
    versionId: v.id("logicProjectVersions"),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.versionId, {
      status: "error",
      errorMessage: args.errorMessage,
    });
  },
});
