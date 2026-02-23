import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Generic optimistic-move hook for kanban drag-and-drop.
 *
 * Maintains a Map of pending moves, clears entries when the server data
 * catches up (checked via `isResolved`), and has a 5-second safety timeout.
 */
export function usePendingMoves<TSong extends { _id: string }, TPending>(
  songs: TSong[] | undefined,
  isResolved: (song: TSong, pending: TPending) => boolean
): [Map<string, TPending>, (songId: string, pending: TPending) => void] {
  const [pending, setPending] = useState<Map<string, TPending>>(
    () => new Map()
  );

  // Keep a stable ref so the effect doesn't re-run when the callback identity changes
  const isResolvedRef = useRef(isResolved);
  useEffect(() => {
    isResolvedRef.current = isResolved;
  });

  // Clear pending moves when server data catches up
  useEffect(() => {
    if (!songs || pending.size === 0) return;
    const songMap = new Map(songs.map((s) => [s._id, s]));
    let changed = false;
    const next = new Map(pending);
    for (const [id, move] of pending) {
      const song = songMap.get(id);
      if (song && isResolvedRef.current(song, move)) {
        next.delete(id);
        changed = true;
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reconciliation: clear pending entries once server data catches up
    if (changed) setPending(next);
  }, [songs, pending]);

  // Safety timeout: clear stale pending moves after 5s
  useEffect(() => {
    if (pending.size === 0) return;
    const timer = setTimeout(() => setPending(new Map()), 5000);
    return () => clearTimeout(timer);
  }, [pending]);

  const addPending = useCallback((songId: string, move: TPending) => {
    setPending((prev) => {
      const next = new Map(prev);
      next.set(songId, move);
      return next;
    });
  }, []);

  return [pending, addPending];
}
