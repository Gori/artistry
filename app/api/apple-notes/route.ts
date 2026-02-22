import { execFileSync } from "child_process";
import { writeFileSync, unlinkSync, readFileSync, existsSync } from "fs";
import { tmpdir, homedir } from "os";
import { join } from "path";
import { NextResponse } from "next/server";

function runJxa(script: string, maxBuffer = 10 * 1024 * 1024): string {
  const scriptPath = join(tmpdir(), `artistry-notes-${Date.now()}.js`);
  try {
    writeFileSync(scriptPath, script, "utf-8");
    return execFileSync("osascript", ["-l", "JavaScript", scriptPath], {
      timeout: 30000,
      encoding: "utf-8",
      maxBuffer,
    }).trim();
  } finally {
    try {
      unlinkSync(scriptPath);
    } catch {
      // ignore
    }
  }
}

function escapeJsString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

// ---------------------------------------------------------------------------
// HTML → plaintext + images
// ---------------------------------------------------------------------------

interface ExtractedImage {
  data: string; // base64
  mimeType: string;
}

function extractFromHtml(html: string): {
  body: string;
  images: ExtractedImage[];
} {
  const images: ExtractedImage[] = [];

  // Extract base64 images and replace with placeholders
  let processed = html.replace(
    /<img[^>]+src="data:(image\/[^;]+);base64,([^"]+)"[^>]*\/?>/gi,
    (_match, mimeType: string, data: string) => {
      const idx = images.length;
      images.push({ data, mimeType });
      return `{{IMG_${idx}}}`;
    }
  );

  // Convert HTML to readable text
  // Replace <br> variants
  processed = processed.replace(/<br\s*\/?>/gi, "\n");
  // Replace block-level closing tags with newlines
  processed = processed.replace(/<\/(div|p|h[1-6]|li|tr|blockquote)>/gi, "\n");
  // Replace <li> with list marker
  processed = processed.replace(/<li[^>]*>/gi, "- ");
  // Strip all remaining HTML tags
  processed = processed.replace(/<[^>]+>/g, "");
  // Decode common HTML entities
  processed = processed
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
  // Collapse excessive blank lines (3+ → 2)
  processed = processed.replace(/\n{3,}/g, "\n\n");
  // Trim
  processed = processed.trim();

  return { body: processed, images };
}

// ---------------------------------------------------------------------------
// Find audio attachment files on disk
// ---------------------------------------------------------------------------

interface AudioAttachmentMeta {
  name: string;
  contentIdentifier: string;
}

interface AudioFile {
  name: string;
  data: string; // base64
  mimeType: string;
}

function findAudioFiles(attachments: AudioAttachmentMeta[]): AudioFile[] {
  if (attachments.length === 0) return [];

  const notesDir = join(
    homedir(),
    "Library/Group Containers/group.com.apple.notes"
  );
  if (!existsSync(notesDir)) return [];

  const results: AudioFile[] = [];

  for (const att of attachments) {
    try {
      // Use `find` to locate the file in the Notes media directory
      const escapedName = att.name.replace(/'/g, "'\\''");
      const found = execFileSync(
        "find",
        [notesDir, "-name", escapedName, "-type", "f"],
        { encoding: "utf-8", timeout: 5000, maxBuffer: 1024 * 1024 }
      ).trim();

      if (!found) continue;

      // Take the first match (most common case: unique filename)
      const filePath = found.split("\n")[0];
      const data = readFileSync(filePath);

      const ext = att.name.split(".").pop()?.toLowerCase() ?? "";
      const mimeMap: Record<string, string> = {
        m4a: "audio/mp4",
        mp3: "audio/mpeg",
        wav: "audio/wav",
        aac: "audio/aac",
        caf: "audio/x-caf",
        aif: "audio/aiff",
        aiff: "audio/aiff",
      };

      results.push({
        name: att.name,
        data: data.toString("base64"),
        mimeType: mimeMap[ext] ?? "audio/mp4",
      });
    } catch {
      // Skip files we can't read
    }
  }

  return results;
}

// GET /api/apple-notes — list folders (with subfolders)
// GET /api/apple-notes?folder=FolderPath — list note titles in folder (no body, fast batch)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const folder = searchParams.get("folder");

  try {
    if (!folder) {
      const raw = runJxa(`
        var Notes = Application("Notes");
        function getFolders(containers, path) {
          var result = [];
          for (var i = 0; i < containers.length; i++) {
            var f = containers[i];
            var name = f.name();
            var fullPath = path ? path + "/" + name : name;
            var count = f.notes().length;
            var children = f.folders();
            result.push({ name: name, path: fullPath, count: count });
            if (children.length > 0) {
              result = result.concat(getFolders(children, fullPath));
            }
          }
          return result;
        }
        JSON.stringify(getFolders(Notes.folders(), "").filter(function(f) { return f.count > 0; }));
      `);
      return NextResponse.json(JSON.parse(raw));
    }

    // Navigate to the folder by path (supports subfolders via "Parent/Child")
    const parts = folder.split("/");
    const escapedParts = parts.map(escapeJsString);
    let folderNav = `Notes.folders.whose({name: "${escapedParts[0]}"})[0]`;
    for (let i = 1; i < escapedParts.length; i++) {
      folderNav += `.folders.whose({name: "${escapedParts[i]}"})[0]`;
    }

    const raw = runJxa(`
      var Notes = Application("Notes");
      var folder = ${folderNav};
      var names = folder.notes.name();
      var ids = folder.notes.id();
      var dates = folder.notes.modificationDate();
      var result = [];
      for (var i = 0; i < names.length; i++) {
        var t = (names[i] || "").split("\\n")[0].replace(/^\\s+|\\s+$/g, "");
        result.push({
          id: ids[i],
          title: t || "Untitled",
          modifiedAt: dates[i].toISOString()
        });
      }
      result.sort(function(a, b) { return b.modifiedAt.localeCompare(a.modifiedAt); });
      JSON.stringify(result);
    `);
    return NextResponse.json(JSON.parse(raw));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("not allowed")) {
      return NextResponse.json(
        { error: "Permission denied. Grant access to Notes in System Settings > Privacy & Security > Automation." },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: `Failed to read Apple Notes: ${message}` },
      { status: 500 }
    );
  }
}

// POST /api/apple-notes — fetch full content for specific note IDs
export async function POST(request: Request) {
  try {
    const { ids } = (await request.json()) as { ids: string[] };
    if (!ids || ids.length === 0) {
      return NextResponse.json([]);
    }

    const idsJson = JSON.stringify(ids);
    // Fetch both plaintext and HTML body, plus audio attachment metadata
    const raw = runJxa(
      `
      var Notes = Application("Notes");
      var targetIds = ${idsJson};
      var result = [];
      for (var i = 0; i < targetIds.length; i++) {
        var matches = Notes.notes.whose({id: targetIds[i]});
        if (matches.length > 0) {
          var note = matches[0];
          var audioAtts = [];
          try {
            var atts = note.attachments();
            for (var j = 0; j < atts.length; j++) {
              var attName = "";
              try { attName = atts[j].name(); } catch(e) {}
              if (attName && /\\.(m4a|mp3|wav|aac|caf|aiff?)$/i.test(attName)) {
                var cid = "";
                try { cid = atts[j].contentIdentifier(); } catch(e) {}
                audioAtts.push({ name: attName, contentIdentifier: cid });
              }
            }
          } catch(e) {}
          result.push({
            id: targetIds[i],
            title: note.name(),
            html: note.body(),
            audioAttachments: audioAtts
          });
        }
      }
      JSON.stringify(result);
    `,
      50 * 1024 * 1024
    );

    const jxaResults = JSON.parse(raw) as Array<{
      id: string;
      title: string;
      html: string;
      audioAttachments: AudioAttachmentMeta[];
    }>;

    // Process each note: extract images from HTML, find audio files on disk
    const processed = jxaResults.map((note) => {
      const { body, images } = extractFromHtml(note.html);
      const audio = findAudioFiles(note.audioAttachments);
      const title = (note.title || "")
        .replace(/[\r\n\u2028\u2029]+/g, " ")
        .replace(/\s+/g, " ")
        .trim() || "Untitled";
      return {
        id: note.id,
        title,
        body,
        images,
        audio,
      };
    });

    return NextResponse.json(processed);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to fetch note content: ${message}` },
      { status: 500 }
    );
  }
}
