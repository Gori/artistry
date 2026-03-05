import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const schema = defineSchema({
  ...authTables,
  workspaces: defineTable({
    name: v.string(),
    slug: v.optional(v.string()),
    createdBy: v.id("users"),
  }).index("by_slug", ["slug"]),
  workspaceMembers: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_user", ["userId"])
    .index("by_workspace_and_user", ["workspaceId", "userId"]),
  songs: defineTable({
    title: v.string(),
    slug: v.optional(v.string()),
    workspaceId: v.id("workspaces"),
    stage: v.union(
      v.literal("idea"),
      v.literal("writing"),
      v.literal("producing"),
      v.literal("mixing"),
      v.literal("done")
    ),
    position: v.number(),
    createdBy: v.id("users"),
    description: v.optional(v.string()),
    tempo: v.optional(v.string()),
    key: v.optional(v.string()),
    tagIds: v.optional(v.array(v.id("tags"))),
    groupId: v.optional(v.id("songGroups")),
    groupPosition: v.optional(v.number()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_and_stage", ["workspaceId", "stage"])
    .index("by_workspace_and_slug", ["workspaceId", "slug"]),
  songGroups: defineTable({
    name: v.string(),
    workspaceId: v.id("workspaces"),
    position: v.number(),
  }).index("by_workspace", ["workspaceId"]),
  tags: defineTable({
    name: v.string(),
    color: v.string(),
    workspaceId: v.id("workspaces"),
  }).index("by_workspace", ["workspaceId"]),
  lyrics: defineTable({
    songId: v.id("songs"),
    content: v.string(),
    updatedBy: v.id("users"),
    updatedAt: v.optional(v.number()),
  }).index("by_song", ["songId"]),
  notes: defineTable({
    songId: v.id("songs"),
    content: v.string(),
    createdBy: v.id("users"),
    updatedAt: v.number(),
  }).index("by_song", ["songId"]),
  songVersions: defineTable({
    songId: v.id("songs"),
    title: v.string(),
    audioUrl: v.optional(v.string()),
    audioFileId: v.optional(v.id("_storage")),
    createdBy: v.id("users"),
    notes: v.optional(v.string()),
    category: v.optional(
      v.union(
        v.literal("demo"),
        v.literal("rough"),
        v.literal("mix"),
        v.literal("final")
      )
    ),
    isCurrent: v.optional(v.boolean()),
    duration: v.optional(v.number()),
    lyricsSnapshotId: v.optional(v.id("lyricsSnapshots")),
  }).index("by_song", ["songId"]),
  audioNotes: defineTable({
    songId: v.id("songs"),
    title: v.optional(v.string()),
    audioUrl: v.optional(v.string()),
    audioFileId: v.optional(v.id("_storage")),
    createdBy: v.id("users"),
    transcription: v.optional(v.string()),
    transcriptionStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("transcribing"),
        v.literal("transcribed"),
        v.literal("failed")
      )
    ),
  }).index("by_song", ["songId"]),
  shareLinks: defineTable({
    songId: v.id("songs"),
    token: v.string(),
    createdBy: v.id("users"),
    expiresAt: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_song", ["songId"]),
  lyricsSnapshots: defineTable({
    songId: v.id("songs"),
    content: v.string(),
    createdBy: v.id("users"),
    label: v.optional(v.string()),
  }).index("by_song", ["songId"]),
  references: defineTable({
    songId: v.id("songs"),
    type: v.union(
      v.literal("image"),
      v.literal("link"),
      v.literal("text"),
      v.literal("color")
    ),
    content: v.string(),
    title: v.optional(v.string()),
    position: v.number(),
    createdBy: v.id("users"),
  }).index("by_song", ["songId"]),
  versionMarkers: defineTable({
    versionId: v.id("songVersions"),
    songId: v.id("songs"),
    timestamp: v.number(),
    text: v.string(),
    createdBy: v.id("users"),
  })
    .index("by_version", ["versionId"])
    .index("by_song", ["songId"]),
});

export default schema;
