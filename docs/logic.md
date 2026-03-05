# Architecture Brief: Collaborative Versioning + Diffing for Logic Pro Projects

## 0) Product intent

Create a service where users can:

* Upload and version **Logic Pro** projects (`.logicx`) with **deduped storage**
* Collaborate asynchronously (review, comment, branch/merge workflows)
* See **meaningful diffs** between versions (“what changed since v11?”)
* Pull any version back to a local machine to open in Logic

Key constraint: Logic’s native project internals are proprietary and not stable to parse. “Exact diffs” must rely on **stable exported artifacts** + robust file-level diffing, not reverse-engineering `ProjectData` blobs.

---

# 1) High-level system overview

## Components

1. **Web App (main site)**

   * Projects dashboard
   * “Logic Projects” tab inside each project
   * Version timeline, diff UI, comments/reviews
   * Download/checkout controls

2. **Backend API**

   * Auth, orgs, projects, permissions
   * Version metadata, manifests, diffs, comments
   * Job orchestration

3. **Object Storage**

   * Content-addressed blob store (audio + project files + exports)
   * Lifecycle, encryption, integrity

4. **Processing Workers**

   * Diff computation (manifest diffs, AAF/MIDI parsing, audio fingerprinting)
   * Audio proxy generation (waveforms, previews)
   * Indexing / search

5. **Native App (Electron)**

   * Watches and snapshots `.logicx`
   * Generates exports automatically (AAF/MIDI/stems) via controlled automation
   * Uploads only changed blobs
   * Pulls versions and rehydrates project bundles

---

# 2) Data model & storage strategy

## Content-addressed storage (CAS)

* Every file/blob is stored by hash (e.g., SHA-256).
* Upload protocol supports resumable chunked upload.
* The “version” is a manifest that references blob hashes.

### Blob types

* `LOGIC_BUNDLE_FILE`: any file within `.logicx` bundle
* `EXPORT_AAF`
* `EXPORT_MIDI` (single file or collection)
* `EXPORT_STEMS` (audio files)
* `AUDIO_PROXY` (mp3/aac for browser playback)
* `WAVEFORM_PEAKS` / `FINGERPRINTS`
* `DIFF_JSON` (computed result)

## Version manifest

A “version” record has:

* `project_id`
* `logic_project_id` (within a broader “Project”)
* `version_id` (monotonic, plus UUID)
* `parent_version_id` (supports branching)
* `created_by`, timestamps
* `snapshot_manifest` (list of files in `.logicx` with hashes)
* `export_manifest` (AAF/MIDI/stems + metadata)
* `client_fingerprint` (app + OS + Logic version, where available)
* `notes` / changelog message
* `status` (uploaded → processing → ready / error)

Manifest entries:

* `path`, `sha256`, `size`, `mtime`, optional `media_metadata` (duration, sr, channels)

---

# 3) Diff philosophy (what “exact changes” means)

## Principle

Offer **deterministic diffs** based on:

1. File-level changes inside `.logicx` (always available)
2. Export-based timeline/MIDI diffs (available when exports succeed)
3. Audio-based diffs using stems/proxies (audible confirmation)

Do **not** promise perfect semantic diffs from proprietary internals across all plugin ecosystems.

## Diff output categories (UI)

* **Files changed**: added/removed/renamed/modified
* **Arrangement** (from AAF): regions moved/trimmed, track adds/removes, basic automation deltas where accessible
* **MIDI**: notes added/removed/edited, CC changes (from exported MIDI)
* **Audio**: stems changed, waveform differences, loudness/length deltas
* **Plugins**: best-effort inventory changes (insert/remove/reorder if inferable), plus “missing plugins” warnings on checkout

Each category should degrade gracefully: if AAF export fails, still show file/audio diffs.

---

# 4) Web interface specification

## 4.1 Navigation

Within an existing “Project” page:

* Tabs: Overview | Files | Activity | **Logic Projects** | Settings
* **Logic Projects tab** lists Logic project entries (a project can have multiple `.logicx` bundles or subprojects)

## 4.2 Logic Projects tab: list view

For each Logic Project:

* Name, last updated, last pushed by, current version, branch indicator
* Status: Clean / Changes pending (from client heartbeat) / Export error / Processing
* Buttons: Open history, Download latest, Settings

## 4.3 Logic Project detail view

Left sidebar:

* Versions
* Branches (optional v1: hide behind “advanced”)
* Settings (export policy, stem settings)

Main area has:

1. **Version timeline**

   * chronological list with commit message, author, timestamp
   * badges: “AAF”, “MIDI”, “Stems” present / missing

2. **Compare / Diff panel**

   * select `A` and `B` versions
   * default compares latest vs previous
   * Diff categories with counts (Files / Arrangement / MIDI / Audio / Plugins)
   * Each category has an expandable list + filters (“only moved regions”, “only stems changed”, etc.)

3. **Review mode**

   * comment threads anchored to:

     * timecode (seconds) + musical location (bar:beat if derivable)
     * stem track name
   * approval states: Requested / Approved / Changes requested
   * simple “assign to” / mention system

4. **Playback panel**

   * browser playback of stem proxies (not full-res)
   * A/B compare stems between versions
   * waveform display; markers/comments displayed on waveform

## 4.4 Version detail page (single version)

* Summary (“What changed in this version”)
* Artifacts available (AAF/MIDI/Stems)
* Download options:

  * “Download Logic bundle (.logicx)” (rehydrated zip)
  * “Download exports” (AAF/MIDI/Stems)
* Diagnostics (for developers/power users):

  * export logs (redacted)
  * missing plugin report (if client provided)
  * integrity hashes

## 4.5 Permissions and collaboration

* Role-based access: Owner / Editor / Commenter / Viewer
* “Pull/Checkout” requires at least Viewer
* “Push” requires Editor
* External sharing optional (tokenized share links for review-only stems)

---

# 5) Backend services & processing jobs

## 5.1 Core APIs

* `POST /logic-projects` create
* `POST /logic-projects/{id}/versions/initiate-upload`

  * returns list of required missing blob hashes + signed upload URLs
* `POST /logic-projects/{id}/versions/complete`

  * includes manifest + export manifest metadata
  * kicks off processing pipeline
* `GET /logic-projects/{id}/versions`
* `GET /logic-projects/{id}/diff?base=v11&head=v12`
* `POST /logic-projects/{id}/comments`
* `GET /logic-projects/{id}/artifacts/{version}`

## 5.2 Processing pipeline (workers)

Triggered when a version is completed.

Jobs:

1. **Manifest diff**

   * compare file lists (added/removed/renamed by hash)
2. **Audio metadata extraction**

   * duration, sr, channels for changed audio
3. **Proxy generation**

   * mp3/aac proxies for stems (and optionally for changed raw audio)
4. **Waveform peaks + fingerprint**

   * store peaks arrays + audio fingerprint hash for diff confidence
5. **AAF parsing & arrangement diff**

   * parse AAF into canonical timeline model
   * diff vs parent version’s timeline model
6. **MIDI parsing & diff**

   * note-level diff, CC diff
7. **Plugin inventory (best-effort)**

   * from client report primarily; fallback heuristics from bundle scanning (non-authoritative)
8. **Diff JSON assembly**

   * produce a single structured diff doc for fast UI rendering

All processing should be idempotent and retryable; store job logs per version.

---

# 6) Electron native app specification

## 6.1 Goals

* One-click “Push” without manual exports
* Reliable snapshotting (no half-written states)
* Resumable uploads + dedupe
* Pull/checkout versions
* Provide diagnostics + missing plugin reporting (best-effort)
* Minimal friction: menu bar optional, but UX should be “Git client simple”

## 6.2 UX screens

1. **Login**
2. **Projects list**

   * shows server projects; search; “Add Logic project”
3. **Logic project view**

   * local path (linked)
   * status: Clean/Dirty/Exporting/Uploading/Error
   * buttons: Push, Pull latest, History, Settings
4. **Push dialog**

   * commit message
   * checkboxes: include stems / include AAF / include MIDI (default on)
   * export preset selector (Stem format, length, etc.)
5. **Settings**

   * Export configuration
   * Upload bandwidth limits
   * Ignored files rules
   * Automation mode (see below)
6. **Diagnostics**

   * last export logs
   * last upload report
   * file integrity check

## 6.3 Local project handling

### Watcher

* Use filesystem events to mark project “dirty”
* Implement debounce + “stable window” detection (e.g., 5–15 seconds no writes) before enabling push
* Detect if Logic is running (optional) to adjust stability strategy

### Snapshot

* On push, copy `.logicx` to a staging location:

  * Prefer fast copy mechanisms where possible (APFS clone if available)
* Apply ignore rules (cache/render scratch if safe)
* Generate manifest + hash missing blobs only (streaming, parallel hashing)

## 6.4 Export automation (non-manual)

This is the hardest part; the app must be explicit about reliability.

### Export modes

**Mode 1: Guided automation (recommended v1)**

* App brings Logic to foreground.
* Shows “Export in progress—don’t touch keyboard/mouse” overlay.
* Drives menu actions via Accessibility/UI scripting.
* Saves exports into an app-controlled `Exports/{version_id}/...` folder.
* Captures screenshots/logs on failure for debugging.

**Mode 2: Background-friendly automation (v2)**

* Attempts to export while user continues work, with stronger detection/locking.
* Only if Mode 1 is stable enough.

### Export targets

* AAF export with consistent settings (document exact choices)
* MIDI export (global + per-track if possible; define canonical)
* Stems:

  * define naming convention stable across versions: `{trackIndex}_{trackName}.wav`
  * define format: WAV/AIFF, sr policy, bit depth, mono/stereo rules
  * handle track rename stability via internal mapping (see below)

### Track identity mapping (important for diffs)

Stems must remain diffable even if tracks are renamed/reordered.
Implement a local mapping file per Logic project:

* `track_guid -> last_seen_name -> stem_filename`
  Where `track_guid` is derived from export data when possible, else a best-effort stable ID:
* prefer AAF track IDs
* fallback: hash of initial stem audio + creation time + path heuristics

This mapping is imperfect but dramatically improves “stem X changed” continuity.

## 6.5 Upload protocol

* Client requests upload session from server, providing the manifest hashes
* Server returns which hashes are missing
* Client uploads only missing blobs (chunked/resumable)
* Client calls “complete version” with:

  * snapshot manifest
  * export manifest + settings used
  * local metadata (macOS version, app version, Logic version if detectable)
  * optional plugin inventory report

## 6.6 Pull/checkout

* Choose version → download manifests → fetch required blobs → rehydrate `.logicx`
* Verify all hashes
* Optionally run “preflight”:

  * show missing plugin list (best-effort)
  * show missing audio assets if any (should be none if bundle complete)

## 6.7 Permissions required

* Full disk access (or user-selected folder access) for `.logicx`
* Accessibility permission for UI automation
* Network permissions
* Optional: notifications

## 6.8 Reliability requirements

* Never corrupt user’s source project; work on snapshot only
* Clear failure states:

  * “Export failed: permission missing”
  * “Export failed: Logic not responsive”
  * “Upload failed: retry/resume”
* Always store raw export logs with user-redaction options

---

# 7) Security, privacy, and compliance

* Encryption in transit (TLS)
* Encryption at rest for blobs (KMS-managed)
* Optional end-to-end client-side encryption (future)
* Clear retention/deletion policy per project
* Audit log of access/download actions
* Watermark/proxy-only sharing option for reviewers

---

# 8) Versioning semantics & collaboration model

## Branching

* Support simple linear history v1
* Data model supports branching from day 1 (parent_version_id)
* UI can hide complexity initially

## Merge strategy

Do **not** attempt auto-merge of Logic internals.
Provide:

* “Compare branches” + review changes
* “Choose which version becomes main”
* Optional “merge by stems” workflow (mixdown-level merges) later

---

# 9) Suggested MVP scope

### Web MVP

* Logic Projects tab
* Version list + file/audio diff
* Stem proxy playback + comments
* Download rehydrated `.logicx` for any version

### Electron MVP

* Add project path
* Push: snapshot + dedupe upload
* Guided export automation (Mode 1) for stems + AAF + MIDI
* Pull latest

Everything else is iterative.

---

# 10) Hand-off notes for the implementing developer

Encourage the dev/team to produce:

* A detailed technical design doc per component
* A “failure modes and recovery” document (export flakiness, interrupted uploads, missing permissions)
* A test strategy:

  * golden projects across multiple Logic versions
  * large audio stress tests
  * export automation regression tests (menu path changes)
* Observability plan:

  * per-version job traces
  * client export logs with structured error codes
  * upload performance metrics
