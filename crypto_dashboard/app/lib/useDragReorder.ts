import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from "react";

export interface DragItemProps {
  draggable: true;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
  onDragOver: (e: DragEvent) => void;
}

export interface DragReorder {
  /** Current manual order of ids. */
  orderIds: string[];
  /** Replace the order outright (e.g. when applying a sort). */
  setOrder: (ids: string[]) => void;
  /** Whether the given id is the card currently being dragged. */
  isDragging: (id: string) => boolean;
  /** Props to spread onto each draggable item. */
  getItemProps: (id: string) => DragItemProps;
}

/**
 * Keeps the manual order while dropping ids that no longer exist and appending
 * any newly-seen ids to the end.
 */
function reconcile(order: string[], ids: string[]): string[] {
  const kept = order.filter((id) => ids.includes(id));
  const added = ids.filter((id) => !kept.includes(id));
  if (added.length === 0 && kept.length === order.length) return order;
  return [...kept, ...added];
}

/**
 * Native HTML5 drag-and-drop reordering for a list of ids.
 *
 * When `storageKey` is provided, the order is written to localStorage as the
 * user reorders, but the stored order is cleared on every page load — so a
 * reload always returns to the default order rather than restoring a previous
 * arrangement.
 */
export function useDragReorder(
  ids: string[],
  storageKey?: string,
): DragReorder {
  const [orderIds, setOrderIds] = useState<string[]>(ids);
  const [dragId, setDragId] = useState<string | null>(null);

  // On mount (a fresh page load/reload), clear any persisted order so the list
  // starts from the default. It is re-populated below as the user reorders.
  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Ignore unavailable storage.
    }
  }, [storageKey]);

  // Reconcile when the source ids change (e.g. after a data refresh).
  const idsKey = ids.join(",");
  useEffect(() => {
    setOrderIds((prev) => reconcile(prev, ids));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  // Persist on change, but skip the initial mount so we don't immediately
  // re-write the default order we just cleared.
  const skipFirstPersist = useRef(true);
  useEffect(() => {
    if (!storageKey) return;
    if (skipFirstPersist.current) {
      skipFirstPersist.current = false;
      return;
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(orderIds));
    } catch {
      // Storage may be full or disabled; ordering still works in-memory.
    }
  }, [storageKey, orderIds]);

  const move = useCallback((from: string, to: string) => {
    setOrderIds((prev) => {
      const f = prev.indexOf(from);
      const t = prev.indexOf(to);
      if (f === -1 || t === -1 || f === t) return prev;
      const next = [...prev];
      next.splice(f, 1);
      next.splice(t, 0, from);
      return next;
    });
  }, []);

  const getItemProps = useCallback(
    (id: string): DragItemProps => ({
      draggable: true,
      onDragStart: () => setDragId(id),
      onDragEnter: () => {
        if (dragId && dragId !== id) move(dragId, id);
      },
      onDragEnd: () => setDragId(null),
      onDragOver: (e: DragEvent) => e.preventDefault(),
    }),
    [dragId, move],
  );

  return {
    orderIds,
    setOrder: setOrderIds,
    isDragging: (id) => dragId === id,
    getItemProps,
  };
}
