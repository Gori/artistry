import { useState, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { Button, Badge } from "@artistry/ui";

const api = (window as any).artistry;

interface Song {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  latestLogicVersionNumber?: number;
  _creationTime: number;
}

interface ProjectListPageProps {
  onSelectSong: (songId: string, songTitle: string) => void;
  onLogout: () => void;
}

export function ProjectListPage({
  onSelectSong,
  onLogout,
}: ProjectListPageProps) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkedSongs, setLinkedSongs] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    loadSongs();
    const interval = setInterval(loadSongs, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadSongs = async () => {
    try {
      const workspaces = await api.convex.query("workspaces:list");
      if (workspaces && workspaces.length > 0) {
        const allSongs: Song[] = [];
        for (const ws of workspaces) {
          const wsSongs = await api.convex.query("songs:listByWorkspace", {
            workspaceId: ws._id,
          });
          allSongs.push(...(wsSongs ?? []));
        }
        setSongs(allSongs);

        const linked = new Map<string, number>();
        for (const song of allSongs) {
          const links = await api.project.getLinks(song._id);
          const activeCount = links.filter((l: { pathMissing: boolean }) => !l.pathMissing).length;
          if (activeCount > 0) {
            linked.set(song._id, activeCount);
          }
        }
        setLinkedSongs(linked);
      }
    } catch (err) {
      console.error("Failed to load songs:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 pt-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Songs</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Select a song to manage Logic Pro versions
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onLogout}>
          Sign Out
        </Button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Loading...
        </div>
      ) : songs.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          No songs found. Create one in the web app first.
        </div>
      ) : (
        <div className="space-y-2">
          {songs.map((song) => (
            <button
              key={song._id}
              type="button"
              className="flex w-full cursor-pointer items-center justify-between rounded-xl border bg-card p-4 text-left shadow-sm transition-colors hover:bg-accent/50"
              onClick={() => onSelectSong(song._id, song.title)}
            >
              <div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  {song.title}
                  {linkedSongs.has(song._id) && (
                    <Badge variant="secondary" className="text-[10px]">
                      {linkedSongs.get(song._id)! === 1
                        ? "1 project"
                        : `${linkedSongs.get(song._id)} projects`}
                    </Badge>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {song.latestLogicVersionNumber
                    ? `Logic v${song.latestLogicVersionNumber}`
                    : "No versions"}
                </div>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
