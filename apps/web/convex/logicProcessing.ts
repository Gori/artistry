import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { computeManifestDiff } from "@artistry/shared";

// Compute diff between two versions by comparing manifests
export const computeDiff = internalMutation({
  args: {
    songId: v.id("songs"),
    fromVersionId: v.id("logicProjectVersions"),
    toVersionId: v.id("logicProjectVersions"),
  },
  handler: async (ctx, args) => {
    const fromVersion = await ctx.db.get(args.fromVersionId);
    const toVersion = await ctx.db.get(args.toVersionId);

    if (!fromVersion || !toVersion) {
      await ctx.db.patch(args.toVersionId, {
        status: "error",
        errorMessage: "Could not find versions for diff computation",
      });
      return;
    }

    // Update processing job status
    const job = await ctx.db
      .query("logicProcessingJobs")
      .withIndex("by_version", (q) => q.eq("versionId", args.toVersionId))
      .first();
    if (job) {
      await ctx.db.patch(job._id, { status: "running" });
    }

    try {
      const { entries: diffEntries, summary } = computeManifestDiff(
        fromVersion.manifest,
        toVersion.manifest
      );

      // Store the diff
      await ctx.db.insert("logicDiffs", {
        songId: args.songId,
        fromVersionId: args.fromVersionId,
        toVersionId: args.toVersionId,
        fromVersionNumber: fromVersion.versionNumber,
        toVersionNumber: toVersion.versionNumber,
        entries: diffEntries,
        summary,
      });

      // Mark job as completed
      if (job) {
        await ctx.db.patch(job._id, { status: "completed" });

        // Clean up other completed/failed jobs for the same version
        const allJobs = await ctx.db
          .query("logicProcessingJobs")
          .withIndex("by_version", (q) => q.eq("versionId", args.toVersionId))
          .collect();
        for (const j of allJobs) {
          if (j._id !== job._id && (j.status === "completed" || j.status === "failed")) {
            await ctx.db.delete(j._id);
          }
        }
      }

      // Mark version as ready
      await ctx.db.patch(args.toVersionId, { status: "ready" });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown processing error";

      if (job) {
        await ctx.db.patch(job._id, {
          status: "failed",
          errorMessage,
        });
      }

      await ctx.db.patch(args.toVersionId, {
        status: "error",
        errorMessage,
      });
    }
  },
});

// Audio file extensions to match in manifests
const AUDIO_EXTENSIONS = [".wav", ".aif", ".aiff"];

function isAudioFile(path: string): boolean {
  const lower = path.toLowerCase();
  return AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

// Generate audio proxy files for a version's audio stems.
// This is a stub implementation — real transcoding (e.g. ffmpeg to mp3/ogg)
// cannot run inside Convex, so we mark each job as completed immediately and
// store the original blob URL as the proxy URL for now.
export const generateAudioProxy = internalMutation({
  args: {
    versionId: v.id("logicProjectVersions"),
    songId: v.id("songs"),
  },
  handler: async (ctx, args) => {
    const version = await ctx.db.get(args.versionId);
    if (!version) {
      return;
    }

    const audioEntries = version.manifest.filter((entry) =>
      isAudioFile(entry.path)
    );

    for (const entry of audioEntries) {
      // Create a processing job for each audio file
      const jobId = await ctx.db.insert("logicProcessingJobs", {
        versionId: args.versionId,
        songId: args.songId,
        type: "audio_proxy",
        status: "pending",
      });

      // Resolve the original blob URL
      const blob = await ctx.db
        .query("logicBlobs")
        .withIndex("by_sha256", (q) => q.eq("sha256", entry.sha256))
        .first();

      if (!blob) {
        await ctx.db.patch(jobId, {
          status: "failed",
          errorMessage: `Blob not found for ${entry.path} (${entry.sha256.substring(0, 16)}...)`,
        });
        continue;
      }

      // Stub: use the original URL as the proxy URL since we cannot transcode
      await ctx.db.patch(jobId, {
        status: "completed",
        result: {
          path: entry.path,
          sha256: entry.sha256,
          originalUrl: blob.url,
          proxyUrl: blob.url,
          size: entry.size,
        },
      });
    }
  },
});

// Generate waveform peak data for a version's audio stems.
// This is a stub implementation — real peak extraction would require decoding
// the audio data. We generate deterministic mock peak data (200 float values
// between 0 and 1) seeded from the file's sha256 hash.
export const generateWaveformPeaks = internalMutation({
  args: {
    versionId: v.id("logicProjectVersions"),
    songId: v.id("songs"),
  },
  handler: async (ctx, args) => {
    const version = await ctx.db.get(args.versionId);
    if (!version) {
      return;
    }

    const audioEntries = version.manifest.filter((entry) =>
      isAudioFile(entry.path)
    );

    for (const entry of audioEntries) {
      // Create a processing job for each audio file
      const jobId = await ctx.db.insert("logicProcessingJobs", {
        versionId: args.versionId,
        songId: args.songId,
        type: "waveform",
        status: "pending",
      });

      // Mark as running
      await ctx.db.patch(jobId, { status: "running" });

      try {
        // Generate mock peak data: 200 values between 0 and 1
        // Use a simple deterministic approach seeded from the sha256 hash
        const peaks: number[] = [];
        const hashChars = entry.sha256.replace(/[^0-9a-f]/gi, "");
        let seed = 0;
        for (let i = 0; i < Math.min(hashChars.length, 16); i++) {
          seed = seed * 16 + parseInt(hashChars[i], 16);
        }

        for (let i = 0; i < 200; i++) {
          // Simple pseudo-random using a linear congruential generator
          seed = (seed * 1103515245 + 12345) & 0x7fffffff;
          const value = (seed % 1000) / 1000;
          // Shape the values to look more like a waveform (bell-curve-ish)
          const position = i / 200;
          const envelope =
            Math.sin(position * Math.PI) * 0.6 + 0.4;
          peaks.push(
            Math.round(value * envelope * 1000) / 1000
          );
        }

        await ctx.db.patch(jobId, {
          status: "completed",
          result: {
            path: entry.path,
            sha256: entry.sha256,
            peaks,
            peakCount: peaks.length,
          },
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error generating waveform";
        await ctx.db.patch(jobId, {
          status: "failed",
          errorMessage,
        });
      }
    }
  },
});

// Query diffs for a project
export const getDiff = internalQuery({
  args: {
    fromVersionId: v.id("logicProjectVersions"),
    toVersionId: v.id("logicProjectVersions"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("logicDiffs")
      .withIndex("by_versions", (q) =>
        q
          .eq("fromVersionId", args.fromVersionId)
          .eq("toVersionId", args.toVersionId)
      )
      .first();
  },
});
