"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useStore, type CommentThreadItem } from "@/app/lib/store";
import { initials } from "@/app/lib/helpers";
import { fx } from "@/app/lib/fx";

const SHEET_EASE: [number, number, number, number] = [0.3, 1.15, 0.35, 1];
const TAPBACKS = ["👏", "❤️", "😂", "💪", "🔥"];
const HOLD_MS = 350;

/** First grapheme of a string, if it's an emoji (for the ＋ free-pick input). */
function firstEmoji(v: string): string | null {
  let g = "";
  try {
    const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment: (s: string) => Iterable<{ segment: string }> } }).Segmenter;
    g = Seg ? ([...new Seg(undefined, { granularity: "grapheme" }).segment(v)][0]?.segment ?? "") : ([...v][0] ?? "");
  } catch {
    g = [...v][0] ?? "";
  }
  return g && /\p{Extended_Pictographic}/u.test(g) ? g : null;
}

/** One comment as a tapback-able chat card. Tap (or hold) → the card lifts,
 *  the sheet dims, and the emoji picker springs in anchored to the card —
 *  the WhatsApp/iMessage pattern. */
function CommentRow({
  c,
  picker,
  onOpenPicker,
  onClosePicker,
}: {
  c: CommentThreadItem;
  picker: { dir: "up" | "down" } | null;
  onOpenPicker: (dir: "up" | "down") => void;
  onClosePicker: () => void;
}) {
  const { reactToComment, showToast } = useStore();
  const holdTimer = useRef<number | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const heldFired = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [plus, setPlus] = useState(false);
  useEffect(() => {
    if (!picker) setPlus(false);
  }, [picker]);

  const openHere = () => {
    // Anchor the picker ABOVE the card, flipping below only when the card is
    // too close to the list's top edge for it to fit.
    let dir: "up" | "down" = "up";
    const el = wrapRef.current;
    const list = el?.closest(".cmt-list");
    if (el && list && el.getBoundingClientRect().top - list.getBoundingClientRect().top < 66) dir = "down";
    navigator.vibrate?.(10);
    onOpenPicker(dir);
  };

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
      openHere();
    }, HOLD_MS);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = startPos.current;
    if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 8) cancelHold();
  };
  const onCardClick = (e: React.MouseEvent) => {
    // The release of a completed hold also fires a click — swallow it.
    if (heldFired.current) {
      heldFired.current = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (picker) onClosePicker();
    else openHere();
  };

  const pick = (emoji: string) => {
    const removing = c.myEmoji === emoji;
    reactToComment(c.id, emoji);
    navigator.vibrate?.(8);
    // Adding/changing a reaction fills the screen with it, iMessage-style.
    if (!removing) fx.emojiRain(emoji);
    onClosePicker();
  };

  const total = c.reactions.reduce((n, g) => n + g.count, 0);
  const whoReacted = (e: React.MouseEvent) => {
    e.stopPropagation();
    showToast(c.reactions.map((g) => `${g.emoji} ${g.names.join(", ")}`).join(" · "));
  };

  return (
    <div className={`cmt${c.mine ? " mine" : ""}${picker ? " held-row" : ""}`}>
      <div className="cmt-ava">{initials(c.name)}</div>
      <div className="cmt-b">
        <div className="cmt-h">
          <span className="cmt-name">{c.mine ? "You" : c.name}</span>
          <span className="cmt-time">{c.tm}</span>
        </div>
        <div className="cmt-cardwrap" ref={wrapRef}>
          <div
            className={`cmt-card${picker ? " held" : ""}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={cancelHold}
            onPointerCancel={cancelHold}
            onPointerLeave={cancelHold}
            onClick={onCardClick}
            onContextMenu={(e) => e.preventDefault()}
          >
            {c.body}
          </div>
          {c.reactions.length > 0 && (
            <button className="cmt-tapback" onClick={whoReacted} aria-label="Who reacted">
              {c.reactions.slice(0, 3).map((g) => (
                <motion.span
                  className={`tb-e${g.mine ? " me" : ""}`}
                  key={g.emoji}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 520, damping: 22 }}
                >
                  {g.emoji}
                </motion.span>
              ))}
              {total > 1 && <span className="tb-n">{total}</span>}
            </button>
          )}
          <AnimatePresence>
            {picker && (
              <motion.div
                className={`cmt-picker ${picker.dir}`}
                style={{ transformOrigin: picker.dir === "up" ? "bottom left" : "top left" }}
                initial={{ opacity: 0, scale: 0.55, y: picker.dir === "up" ? 10 : -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.6, y: picker.dir === "up" ? 6 : -6, transition: { duration: 0.12 } }}
                transition={{ type: "spring", stiffness: 520, damping: 30 }}
                onClick={(e) => e.stopPropagation()}
              >
                {!plus ? (
                  <>
                    {TAPBACKS.map((e, i) => (
                      <motion.button
                        key={e}
                        className={c.myEmoji === e ? "sel" : ""}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 640, damping: 22, delay: 0.02 + i * 0.026 }}
                        onClick={() => pick(e)}
                      >
                        {e}
                      </motion.button>
                    ))}
                    <motion.button
                      key="plus"
                      className="plus"
                      aria-label="Any emoji"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 640, damping: 22, delay: 0.02 + TAPBACKS.length * 0.026 }}
                      onClick={() => setPlus(true)}
                    >
                      ＋
                    </motion.button>
                  </>
                ) : (
                  <input
                    className="cmt-emoji-in"
                    autoFocus
                    placeholder="Type any emoji…"
                    onInput={(e) => {
                      const g = firstEmoji((e.target as HTMLInputElement).value);
                      if (g) pick(g);
                      else (e.target as HTMLInputElement).value = "";
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") onClosePicker();
                    }}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
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
  const [pickerFor, setPickerFor] = useState<{ id: string; dir: "up" | "down" } | null>(null);
  // The finger-release that completed the long-press also produces a click —
  // ignore backdrop dismissals within a beat of the picker opening.
  const pickerOpenedAt = useRef(0);
  const openPicker = (id: string, dir: "up" | "down") => {
    pickerOpenedAt.current = Date.now();
    setPickerFor({ id, dir });
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
    >
      <div className="shead">
        <h2>Comments</h2>
      </div>
      {item && (
        <div className="cmt-sub">
          {`${item.n} · ${item.act ?? "Workout"}`}
          {comments.length > 0 && <span className="cmt-hint"> · tap a comment to react</span>}
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
              picker={pickerFor?.id === c.id ? { dir: pickerFor.dir } : null}
              onOpenPicker={(dir) => openPicker(c.id, dir)}
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
        <button className="cmt-send" onClick={send} disabled={!text.trim()} aria-label="Post comment">
          ↑
        </button>
      </div>

      {/* WhatsApp-style dim layer while a picker is up — everything else fades
          back; tapping it dismisses. Fixed inside the transformed sheet, so it
          covers exactly the sheet's visible frame regardless of scroll. */}
      <AnimatePresence>
        {pickerFor && (
          <motion.div
            className="cmt-dim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={() => {
              if (Date.now() - pickerOpenedAt.current > 400) setPickerFor(null);
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
