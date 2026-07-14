"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/app/lib/store";

/**
 * Slide-down toast. Kept permanently mounted (like the mock) so hiding it
 * slides it back up rather than unmounting. `showUndoToast` adds an Undo link.
 * Content is read straight from the store's current toast; a new toast key
 * re-runs the show/auto-hide timer.
 */
export default function Toast() {
  const { toast } = useStore();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!toast) return;
    // Defer the show so the slide-in transition runs even for a re-shown toast.
    const show = requestAnimationFrame(() => setVisible(true));
    const hide = setTimeout(() => setVisible(false), toast.duration);
    return () => {
      cancelAnimationFrame(show);
      clearTimeout(hide);
    };
  }, [toast]);

  const onUndo = () => {
    setVisible(false);
    toast?.undo?.();
  };

  return (
    <div className={`toast${visible ? " show" : ""}`}>
      {toast?.message}
      {toast?.undo && (
        <>
          {" · "}
          <span className="undo" onClick={onUndo}>
            Undo
          </span>
        </>
      )}
    </div>
  );
}
