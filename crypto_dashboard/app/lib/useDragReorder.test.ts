import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useDragReorder } from "./useDragReorder";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("useDragReorder", () => {
  it("starts with the provided id order", () => {
    const { result } = renderHook(() => useDragReorder(["a", "b", "c"]));
    expect(result.current.orderIds).toEqual(["a", "b", "c"]);
  });

  it("replaces the order via setOrder", () => {
    const { result } = renderHook(() => useDragReorder(["a", "b", "c"]));
    act(() => result.current.setOrder(["c", "b", "a"]));
    expect(result.current.orderIds).toEqual(["c", "b", "a"]);
  });

  it("tracks the dragging id across start and end", () => {
    const { result } = renderHook(() => useDragReorder(["a", "b", "c"]));

    act(() => result.current.getItemProps("a").onDragStart());
    expect(result.current.isDragging("a")).toBe(true);
    expect(result.current.isDragging("b")).toBe(false);

    act(() => result.current.getItemProps("a").onDragEnd());
    expect(result.current.isDragging("a")).toBe(false);
  });

  it("moves the dragged item when entering another item", () => {
    const { result } = renderHook(() => useDragReorder(["a", "b", "c"]));

    act(() => result.current.getItemProps("a").onDragStart());
    act(() => result.current.getItemProps("c").onDragEnter());

    expect(result.current.orderIds).toEqual(["b", "c", "a"]);
  });

  it("does not move when entering the item being dragged", () => {
    const { result } = renderHook(() => useDragReorder(["a", "b", "c"]));

    act(() => result.current.getItemProps("a").onDragStart());
    act(() => result.current.getItemProps("a").onDragEnter());

    expect(result.current.orderIds).toEqual(["a", "b", "c"]);
  });

  it("reconciles when source ids change: drops removed, appends new, keeps order", () => {
    const { result, rerender } = renderHook(
      ({ ids }: { ids: string[] }) => useDragReorder(ids),
      { initialProps: { ids: ["a", "b", "c"] } },
    );

    act(() => result.current.setOrder(["c", "a", "b"]));
    rerender({ ids: ["a", "b", "d"] });

    expect(result.current.orderIds).toEqual(["a", "b", "d"]);
  });

  describe("with a storage key", () => {
    const KEY = "test:card-order";

    it("clears any persisted order on mount", () => {
      localStorage.setItem(KEY, JSON.stringify(["x", "y"]));
      renderHook(() => useDragReorder(["a", "b"], KEY));
      expect(localStorage.getItem(KEY)).toBeNull();
    });

    it("persists the order after it changes", () => {
      const { result } = renderHook(() => useDragReorder(["a", "b"], KEY));
      // Initial mount must not re-write the order it just cleared.
      expect(localStorage.getItem(KEY)).toBeNull();

      act(() => result.current.setOrder(["b", "a"]));
      expect(localStorage.getItem(KEY)).toBe(JSON.stringify(["b", "a"]));
    });
  });
});
