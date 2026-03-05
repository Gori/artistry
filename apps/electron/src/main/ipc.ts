import { ipcMain, dialog, BrowserWindow } from "electron";
import { existsSync } from "fs";
import { Watcher } from "./services/watcher";
import { Snapshotter } from "./services/snapshotter";
import { ManifestGenerator } from "./services/manifest-generator";
import { UploadManager } from "./services/upload-manager";
import { Rehydrator } from "./services/rehydrator";
import { ConvexService } from "./services/convex-client";
import { ProjectLinkStore } from "./services/project-links";

const WEB_URL = "http://localhost:3003";

// Keyed by projectPath (multiple projects can be linked to one song)
const watchers = new Map<string, Watcher>();
const convexService = new ConvexService();
const linkStore = new ProjectLinkStore();

function sendToAll(channel: string, data: unknown) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, data);
  }
}

export function registerIpcHandlers() {
  // Auth - check if already logged in from previous session
  ipcMain.handle("auth:isAuthenticated", async () => {
    return convexService.isAuthenticated();
  });

  // Auth - email/password sign in
  ipcMain.handle(
    "auth:signIn",
    async (_event, { email, password }: { email: string; password: string }) => {
      return convexService.signIn(email, password);
    }
  );

  // Auth - email/password sign up
  ipcMain.handle(
    "auth:signUp",
    async (
      _event,
      { email, password, name }: { email: string; password: string; name: string }
    ) => {
      return convexService.signUp(email, password, name);
    }
  );


  // Upload proxy — renderer sends file data, main process forwards to web API
  ipcMain.handle(
    "upload:audio",
    async (_event, { arrayBuffer, filename, mimeType }: { arrayBuffer: ArrayBuffer; filename: string; mimeType: string }) => {
      const formData = new FormData();
      formData.append("file", new Blob([arrayBuffer], { type: mimeType }), filename);
      const response = await fetch(`${WEB_URL}/api/upload/audio`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Upload failed");
      return response.json();
    }
  );

  ipcMain.handle(
    "upload:image",
    async (_event, { arrayBuffer, filename, mimeType }: { arrayBuffer: ArrayBuffer; filename: string; mimeType: string }) => {
      const formData = new FormData();
      formData.append("file", new Blob([arrayBuffer], { type: mimeType }), filename);
      const response = await fetch(`${WEB_URL}/api/upload`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Upload failed");
      return response.json();
    }
  );

  ipcMain.handle("auth:logout", async () => {
    convexService.disconnect();
    for (const [, watcher] of watchers) {
      watcher.stop();
    }
    watchers.clear();
    return { success: true };
  });

  // Convex queries/mutations proxied through main process
  ipcMain.handle("convex:query", async (_event, { name, args }) => {
    return convexService.query(name, args);
  });

  ipcMain.handle("convex:mutation", async (_event, { name, args }) => {
    return convexService.mutation(name, args);
  });

  // File system - select directory
  ipcMain.handle("fs:selectDirectory", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "Logic Pro Projects", extensions: ["logicx"] }],
      message: "Select your .logicx project",
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle("fs:selectSaveLocation", async (_event, { defaultPath }) => {
    const result = await dialog.showSaveDialog({
      defaultPath,
      properties: ["createDirectory"],
    });
    if (result.canceled || !result.filePath) return null;
    return result.filePath;
  });

  // --- Project Link ---

  ipcMain.handle("project:link", async (_event, { songId }) => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "Logic Pro Projects", extensions: ["logicx"] }],
      message: "Select the .logicx project to link",
    });
    if (result.canceled || result.filePaths.length === 0) return null;

    const projectPath = result.filePaths[0];
    const link = linkStore.link(songId, projectPath);
    return { projectPath: link.projectPath, linkedAt: link.linkedAt };
  });

  ipcMain.handle("project:unlink", async (_event, { songId, projectPath }) => {
    // Stop active watcher for this projectPath
    const watcher = watchers.get(projectPath);
    if (watcher) {
      watcher.stop();
      watchers.delete(projectPath);
    }
    linkStore.unlink(songId, projectPath);
    return { success: true };
  });

  ipcMain.handle("project:getLinks", async (_event, { songId }) => {
    const links = linkStore.getLinks(songId);
    return links.map((link) => ({
      ...link,
      pathMissing: !existsSync(link.projectPath),
    }));
  });

  ipcMain.handle("project:analyzeLocal", async (_event, { songId, projectPath }) => {
    if (!projectPath) throw new Error("No project path provided");
    if (!existsSync(projectPath)) throw new Error("Project path not found on disk");

    const manifestGen = new ManifestGenerator();
    const manifest = await manifestGen.generate(projectPath);
    return { manifest, analyzedAt: Date.now() };
  });

  // Watcher — enhanced to auto-analyze on stable
  ipcMain.handle("watcher:start", async (_event, { projectPath, songId }) => {
    try {
      if (watchers.has(projectPath)) {
        watchers.get(projectPath)!.stop();
      }

      const watcher = new Watcher(projectPath, {
        debounceMs: 15000,
        onStable: async () => {
          // Auto-generate manifest when project stabilizes
          try {
            const manifestGen = new ManifestGenerator();
            const manifest = await manifestGen.generate(projectPath);
            sendToAll("watcher:changed", { songId, projectPath, manifest });
          } catch (err) {
            console.error("[watcher:onStable] manifest generation failed:", err);
            sendToAll("watcher:changed", { songId, projectPath });
          }
        },
      });

      watcher.start();
      watchers.set(projectPath, watcher);
      return { success: true };
    } catch (err) {
      console.error("[ipc:watcher:start] error:", err);
      throw err;
    }
  });

  ipcMain.handle("watcher:stop", async (_event, { projectPath }) => {
    const watcher = watchers.get(projectPath);
    if (watcher) {
      watcher.stop();
      watchers.delete(projectPath);
    }
    return { success: true };
  });

  // Push — projectPath is now optional (falls back to linked path)
  ipcMain.handle(
    "project:push",
    async (_event, { projectPath, songId, message }) => {
      try {
        // Resolve project path: explicit or from first linked project
        const resolvedPath = projectPath ?? linkStore.getLinks(songId)[0]?.projectPath;
        if (!resolvedPath) {
          return { success: false, error: "No project path provided and no linked project" };
        }
        if (!existsSync(resolvedPath)) {
          return { success: false, error: "Project path not found on disk" };
        }

        // 1. Snapshot
        const snapshotter = new Snapshotter();
        const snapshotPath = await snapshotter.createSnapshot(resolvedPath);

        // 2. Generate manifest
        const manifestGen = new ManifestGenerator();
        const manifest = await manifestGen.generate(snapshotPath);

        // 3. Initiate upload via Convex
        const initResult = await convexService.mutation(
          "logicProjectVersions:initiateUpload",
          {
            songId,
            message,
            manifest: manifest.entries,
            totalSize: manifest.totalSize,
            fileCount: manifest.fileCount,
          }
        );

        // 4. Upload missing blobs directly to R2
        const uploader = new UploadManager();
        const missingEntries = manifest.entries.filter((e: { sha256: string }) =>
          initResult.missingHashes.includes(e.sha256)
        );

        // Dedupe by hash
        const seen = new Set<string>();
        const uniqueEntries = missingEntries.filter((e: { sha256: string }) => {
          if (seen.has(e.sha256)) return false;
          seen.add(e.sha256);
          return true;
        });

        let uploaded = 0;
        for (const entry of uniqueEntries) {
          const fullPath = require("path").join(snapshotPath, entry.path);
          const result = await uploader.uploadFile(fullPath, entry.sha256);

          // Register blob in Convex
          await convexService.mutation("logicBlobs:register", {
            sha256: entry.sha256,
            url: result.url,
            size: entry.size,
          });

          uploaded++;
          sendToAll("push:progress", {
            songId,
            phase: "uploading",
            current: uploaded,
            total: uniqueEntries.length,
          });
        }

        // 5. Complete upload
        const completeResult = await convexService.mutation(
          "logicProjectVersions:completeUpload",
          { versionId: initResult.versionId }
        );

        // 6. Cleanup snapshot
        await snapshotter.cleanup(snapshotPath);

        return {
          success: true,
          versionNumber: completeResult.versionNumber,
          uploaded: uniqueEntries.length,
          deduped: initResult.existingCount,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Push failed",
        };
      }
    }
  );

  // Pull (download + rehydrate)
  ipcMain.handle(
    "project:pull",
    async (_event, { versionId, targetPath }) => {
      try {
        // 1. Get download URLs
        const downloadData = await convexService.query(
          "logicProjectVersions:getDownloadUrls",
          { versionId }
        );

        // 2. Rehydrate
        const rehydrator = new Rehydrator();
        await rehydrator.rehydrate(downloadData.entries, targetPath, (progress) => {
          sendToAll("pull:progress", {
            versionId,
            ...progress,
          });
        });

        return {
          success: true,
          path: targetPath,
          fileCount: downloadData.entries.length,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Pull failed",
        };
      }
    }
  );
}
