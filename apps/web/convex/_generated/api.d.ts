/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as audioNotes from "../audioNotes.js";
import type * as auth from "../auth.js";
import type * as http from "../http.js";
import type * as lib_slugify from "../lib/slugify.js";
import type * as lyrics from "../lyrics.js";
import type * as lyricsSnapshots from "../lyricsSnapshots.js";
import type * as migrations from "../migrations.js";
import type * as notes from "../notes.js";
import type * as references from "../references.js";
import type * as shareLinks from "../shareLinks.js";
import type * as songGroups from "../songGroups.js";
import type * as songVersions from "../songVersions.js";
import type * as songs from "../songs.js";
import type * as tags from "../tags.js";
import type * as transcription from "../transcription.js";
import type * as users from "../users.js";
import type * as versionMarkers from "../versionMarkers.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  audioNotes: typeof audioNotes;
  auth: typeof auth;
  http: typeof http;
  "lib/slugify": typeof lib_slugify;
  lyrics: typeof lyrics;
  lyricsSnapshots: typeof lyricsSnapshots;
  migrations: typeof migrations;
  notes: typeof notes;
  references: typeof references;
  shareLinks: typeof shareLinks;
  songGroups: typeof songGroups;
  songVersions: typeof songVersions;
  songs: typeof songs;
  tags: typeof tags;
  transcription: typeof transcription;
  users: typeof users;
  versionMarkers: typeof versionMarkers;
  workspaces: typeof workspaces;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
