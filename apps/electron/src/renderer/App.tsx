import { useState, useCallback, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { LoginPage } from "./pages/Login";
import { ProjectListPage } from "./pages/ProjectList";
import { ProjectViewPage } from "./pages/ProjectView";

const api = (window as any).artistry;

type Page =
  | { name: "loading" }
  | { name: "login" }
  | { name: "songs" }
  | { name: "song"; songId: string; songTitle: string };

export function App() {
  const [page, setPage] = useState<Page>({ name: "loading" });

  // Check if already authenticated from a previous session
  useEffect(() => {
    api.auth.isAuthenticated().then((authed: boolean) => {
      setPage(authed ? { name: "songs" } : { name: "login" });
    });
  }, []);

  const handleLogin = useCallback(() => {
    setPage({ name: "songs" });
  }, []);

  const handleLogout = useCallback(async () => {
    await api.auth.logout();
    setPage({ name: "login" });
  }, []);

  const handleSelectSong = useCallback(
    (songId: string, songTitle: string) => {
      setPage({ name: "song", songId, songTitle });
    },
    []
  );

  const handleBack = useCallback(() => {
    setPage({ name: "songs" });
  }, []);

  if (page.name === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (page.name === "login") {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (page.name === "songs") {
    return (
      <ProjectListPage
        onSelectSong={handleSelectSong}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <ProjectViewPage
      songId={page.songId}
      songTitle={page.songTitle}
      onBack={handleBack}
    />
  );
}
