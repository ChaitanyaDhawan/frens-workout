"use client";

import { useRef, useState } from "react";
import { motion } from "motion/react";
import { useStore, type CommentThreadItem } from "@/app/lib/store";
import { initials } from "@/app/lib/helpers";

const SHEET_EASE: [number, number, number, number] = [0.3, 1.15, 0.35, 1];
const TAPBACKS = ["👏", "❤️", "😂", "💪", "🔥"];
const HOLD_MS = 420;

/** One comment as a tapback-able card: hold to open the emoji picker; existing
 *  reactions ride the card's corner as overlapping bubbles (iMessage-style). */
function CommentRow({
  c,
  pickerOpen,
  onOpenPicker,
  onClosePicker,
}: {
  c: CommentThreadItem;
  pickerOpen: boolean;
  onOpenPicker: () => void;
  onClosePicker: () => void;
}) {
  const { reactToComment, showToast } = useStore();
  const holdTimer = useRef<number | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  // The release after a successful hold also fires a click, which would bubble
  // to the sheet's tap-outside-dismiss and close the picker it just opened.
  const heldFired = useRef(false);

  const cancelHold = () => {
    if (holdTimer.current != null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    startPos.current = null;
  };
  const onPointerDown = (e: React.PointerEvent) => {
    startPos.current = { x: e.clientX, y: e.clientY };
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null;
      heldFired.current = true;
      navigator.vibrate?.(10);
      onOpenPicker();
    }, HOLD_MS);
  };
  const swallowHoldClick = (e: React.MouseEvent) => {
    if (heldFired.current) {
      heldFired.current = false;
      e.preventDefault();
      e.stopPropagation();
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    // A scroll gesture isn't a hold — bail once the finger drifts.
    const s = startPos.current;
    if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 8) cancelHold();
  };

  const total = c.reactions.reduce((n, g) => n + g.count, 0);
  const whoReacted = () =>
    showToast(c.reactions.map((g) => `${g.emoji} ${g.names.join(", ")}`).join(" · "));

  return (
    <div className={`cmt${c.mine ? " mine" : ""}`}>
      <div className="cmt-ava">{initials(c.name)}</div>
      <div className="cmt-b">
        <div className="cmt-h">
          <span className="cmt-name">{c.mine ? "You" : c.name}</span>
          <span className="cmt-time">{c.tm}</span>
        </div>
        <div className="cmt-cardwrap">
          <div
            className={`cmt-card${pickerOpen ? " held" : ""}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={cancelHold}
            onPointerCancel={cancelHold}
            onPointerLeave={cancelHold}
            onClick={swallowHoldClick}
            onContextMenu={(e) => e.preventDefault()}
          >
            {c.body}
          </div>
          {c.reactions.length > 0 && (
            <button className="cmt-tapback" onClick={whoReacted} aria-label="Who reacted">
              {c.reactions.slice(0, 3).map((g) => (
                <span className={`tb-e${g.mine ? " me" : ""}`} key={g.emoji}>
                  {g.emoji}
                </span>
              ))}
              {total > 1 && <span className="tb-n">{total}</span>}
            </button>
          )}
        </div>
        {pickerOpen && (
          <div className="cmt-picker">
            {TAPBACKS.map((e) => (
              <button
                key={e}
                className={c.myEmoji === e ? "sel" : ""}
                onClick={() => {
                  reactToComment(c.id, e);
                  navigator.vibrate?.(8);
                  onClosePicker();
                }}
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Bottom-sheet comment thread for a single workout. */
export default function CommentSheet() {
  const { commentSheet, commentsByWorkout, feed, addComment } = useStore();
  // Keep the last non-null id so the thread stays rendered during exit animation.
  const snap = useRef(commentSheet);
  if (commentSheet) snap.current = commentSheet;
  const workoutId = snap.current;
  const [text, setText] = useState("");
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  // The finger-release that COMPLETED the long-press produces a click (whose
  // target can be an ancestor once the held card transforms), which would
  // instantly dismiss the picker it just opened — ignore dismissals that
  // arrive within a beat of opening.
  const pickerOpenedAt = useRef(0);
  const openPicker = (id: string) => {
    pickerOpenedAt.current = Date.now();
    setPickerFor(id);
  };

  const comments = workoutId ? commentsByWorkout.get(workoutId) ?? [] : [];
  const item = workoutId ? feed.find((f) => f.id === workoutId) : undefined;

  const send = () => {
    const t = text.trim();
    if (!t || !workoutId) return;
    addComment(workoutId, t);
    setText("");
  };

  return (
    <motion.div
      className="sheet csheet"
      style={{ x: "-50%" }}
      initial={{ y: "105%" }}
      animate={{ y: 0 }}
      exit={{ y: "105%" }}
      transition={{ duration: 0.4, ease: SHEET_EASE }}
      onClick={(e) => {
        // Tap anywhere outside the picker dismisses it (but not the release-
        // click of the long-press that opened it).
        if (
          pickerFor &&
          Date.now() - pickerOpenedAt.current > 400 &&
          !(e.target as HTMLElement).closest(".cmt-picker")
        ) {
          setPickerFor(null);
        }
      }}
    >
      <div className="shead">
        <h2>Comments</h2>
      </div>
      {item && (
        <div className="cmt-sub">
          {`${item.n} · ${item.act ?? "Workout"}`}
          {comments.length > 0 && <span className="cmt-hint"> · hold a comment to react</span>}
        </div>
      )}

      <div className="cmt-list">
        {comments.length === 0 ? (
          <div className="cmt-empty">No comments yet — start the thread 💬</div>
        ) : (
          comments.map((c) => (
            <CommentRow
              key={c.id}
              c={c}
              pickerOpen={pickerFor === c.id}
              onOpenPicker={() => openPicker(c.id)}
              onClosePicker={() => setPickerFor(null)}
            />
          ))
        )}
      </div>

      <div className="cmt-composer">
        <textarea
          className="cmt-input"
          placeholder="Add a comment…"
          rows={1}
          maxLength={500}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button className="cmt-send" onClick={send} disabled={!text.trim()}>
          Post
        </button>
      </div>
    </motion.div>
  );
}
