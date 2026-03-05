import { contextBridge, ipcRenderer } from "electron";
import type { VersionManifest } from "@artistry/shared";

const api = {
  // Auth - email/password
  auth: {
    isAuthenticated: () =>
      ipcRenderer.invoke("auth:isAuthenticated") as Promise<boolean>,
    signIn: (email: string, password: string) =>
      ipcRenderer.invoke("auth:signIn", { email, password }),
    signUp: (email: string, password: string, name: string) =>
      ipcRenderer.invoke("auth:signUp", { email, password, name }),
    logout: () => ipcRenderer.invoke("auth:logout"),
  },

  // Convex
  convex: {
    query: (name: string, args?: Record<string, unknown>) =>
      ipcRenderer.invoke("convex:query", { name, args }),
    mutation: (name: string, args?: Record<string, unknown>) =>
      ipcRenderer.invoke("convex:mutation", { name, args }),
  },

  // File system
  fs: {
    selectDirectory: () => ipcRenderer.invoke("fs:selectDirectory"),
    selectSaveLocation: (defaultPath: string) =>
      ipcRenderer.invoke("fs:selectSaveLocation", { defaultPath }),
  },

  // Upload (for renderer-side uploads)
  upload: {
    audio: (arrayBuffer: ArrayBuffer, filename: string, mimeType: string) =>
      ipcRenderer.invoke("upload:audio", { arrayBuffer, filename, mimeType }),
    image: (arrayBuffer: ArrayBuffer, filename: string, mimeType: string) =>
      ipcRenderer.invoke("upload:image", { arrayBuffer, filename, mimeType }),
  },

  // Watcher
  watcher: {
    start: (projectPath: string, songId: string) =>
      ipcRenderer.invoke("watcher:start", { projectPath, songId }),
    stop: (projectPath: string) =>
      ipcRenderer.invoke("watcher:stop", { projectPath }),
    onChange: (
      callback: (data: {
        songId: string;
        projectPath: string;
        manifest?: VersionManifest;
      }) => void
    ) => {
      const handler = (_event: Electron.IpcRendererEvent, data: any) =>
        callback(data);
      ipcRenderer.on("watcher:changed", handler);
      return () => ipcRenderer.removeListener("watcher:changed", handler);
    },
  },

  // Project link + push/pull
  project: {
    link: (songId: string) =>
      ipcRenderer.invoke("project:link", { songId }) as Promise<{
        projectPath: string;
        linkedAt: number;
      } | null>,

    unlink: (songId: string, projectPath: string) =>
      ipcRenderer.invoke("project:unlink", { songId, projectPath }) as Promise<{
        success: boolean;
      }>,

    getLinks: (songId: string) =>
      ipcRenderer.invoke("project:getLinks", { songId }) as Promise<
        Array<{
          projectPath: string;
          linkedAt: number;
          pathMissing: boolean;
        }>
      >,

    analyzeLocal: (songId: string, projectPath: string) =>
      ipcRenderer.invoke("project:analyzeLocal", { songId, projectPath }) as Promise<{
        manifest: VersionManifest;
        analyzedAt: number;
      }>,

    push: (params: {
      projectPath?: string;
      songId: string;
      message?: string;
    }) => ipcRenderer.invoke("project:push", params),

    pull: (params: { versionId: string; targetPath: string }) =>
      ipcRenderer.invoke("project:pull", params),

    onPushProgress: (
      callback: (data: {
        songId: string;
        phase: string;
        current: number;
        total: number;
      }) => void
    ) => {
      const handler = (_event: Electron.IpcRendererEvent, data: any) =>
        callback(data);
      ipcRenderer.on("push:progress", handler);
      return () => ipcRenderer.removeListener("push:progress", handler);
    },

    onPullProgress: (
      callback: (data: {
        versionId: string;
        phase: string;
        current: number;
        total: number;
      }) => void
    ) => {
      const handler = (_event: Electron.IpcRendererEvent, data: any) =>
        callback(data);
      ipcRenderer.on("pull:progress", handler);
      return () => ipcRenderer.removeListener("pull:progress", handler);
    },
  },
};

contextBridge.exposeInMainWorld("artistry", api);

export type ArtistrAPI = typeof api;
