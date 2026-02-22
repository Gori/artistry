import { internalMutation } from "./_generated/server";
import { generateUniqueSlug } from "./lib/slugify";

export const renameStageToProd = internalMutation({
  args: {},
  handler: async (ctx) => {
    const songs = await ctx.db.query("songs").collect();
    let count = 0;
    for (const song of songs) {
      if ((song.stage as string) === "recording") {
        await ctx.db.patch(song._id, { stage: "producing" });
        count++;
      }
    }
    return { updated: count };
  },
});

export const backfillSlugs = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Backfill workspace slugs
    const workspaces = await ctx.db.query("workspaces").collect();
    for (const workspace of workspaces) {
      if (workspace.slug) continue;

      const slug = await generateUniqueSlug(workspace.name, async (candidate) => {
        const existing = await ctx.db
          .query("workspaces")
          .withIndex("by_slug", (q) => q.eq("slug", candidate))
          .first();
        return existing !== null;
      });

      await ctx.db.patch(workspace._id, { slug });
    }

    // Backfill song slugs
    const songs = await ctx.db.query("songs").collect();
    for (const song of songs) {
      if (song.slug) continue;

      const slug = await generateUniqueSlug(song.title, async (candidate) => {
        const existing = await ctx.db
          .query("songs")
          .withIndex("by_workspace_and_slug", (q) =>
            q.eq("workspaceId", song.workspaceId).eq("slug", candidate)
          )
          .first();
        return existing !== null;
      });

      await ctx.db.patch(song._id, { slug });
    }

    return {
      workspaces: workspaces.length,
      songs: songs.length,
    };
  },
});
