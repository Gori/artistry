import { app } from "electron";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

export interface ProjectLink {
  projectPath: string;
  linkedAt: number;
}

type LinkData = Record<string, ProjectLink[]>;

const linksPath = join(app.getPath("userData"), "project-links.json");

function loadLinks(): LinkData {
  try {
    const raw = JSON.parse(readFileSync(linksPath, "utf-8"));
    // Migration: wrap single-object entries in arrays
    let migrated = false;
    for (const key of Object.keys(raw)) {
      if (!Array.isArray(raw[key])) {
        raw[key] = [raw[key]];
        migrated = true;
      }
    }
    if (migrated) {
      writeFileSync(linksPath, JSON.stringify(raw, null, 2), "utf-8");
    }
    return raw;
  } catch {
    return {};
  }
}

function saveLinks(data: LinkData) {
  writeFileSync(linksPath, JSON.stringify(data, null, 2), "utf-8");
}

export class ProjectLinkStore {
  link(songId: string, projectPath: string): ProjectLink {
    const links = loadLinks();
    const arr = links[songId] ?? [];
    // Check for duplicate projectPath
    if (arr.some((e) => e.projectPath === projectPath)) {
      return arr.find((e) => e.projectPath === projectPath)!;
    }
    const entry: ProjectLink = { projectPath, linkedAt: Date.now() };
    arr.push(entry);
    links[songId] = arr;
    saveLinks(links);
    return entry;
  }

  unlink(songId: string, projectPath: string): void {
    const links = loadLinks();
    const arr = links[songId];
    if (!arr) return;
    const filtered = arr.filter((e) => e.projectPath !== projectPath);
    if (filtered.length === 0) {
      delete links[songId];
    } else {
      links[songId] = filtered;
    }
    saveLinks(links);
  }

  getLinks(songId: string): ProjectLink[] {
    const links = loadLinks();
    return links[songId] ?? [];
  }
}
