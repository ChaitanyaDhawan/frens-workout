"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useStore, type CommentThreadItem } from "@/app/lib/store";
import { initials } from "@/app/lib/helpers";
import { fx } from "@/app/lib/fx";
import EmojiPicker from "./EmojiPicker";

const SHEET_EASE: [number, number, number, number] = [0.3, 1.15, 0.35, 1];
const TAPBACKS = ["👏", "❤️", "😂", "💪", "🔥"];
const HOLD_MS = 350;

/** One comment as a tapback-able chat card. Tap (or hold) → the card lifts,
 *  the sheet dims, and the emoji picker springs in anchored to the card —
 *  the WhatsApp/iMessage pattern. */
function CommentRow({
  c,
  picker,
  onOpenPicker,
  onClosePicker,
  onDismissPicker,
  onOpenGrid,
}: {
  c: CommentThreadItem;
  picker: { dir: "up" | "down" } | null;
  onOpenPicker: (dir: "up" | "down", fromHold: boolean) => void;
  /** Unguarded close — for deliberate actions (picking, card tap). */
  onClosePicker: () => void;
  /** Guarded close — for ambient clicks that might be a hold's release. */
  onDismissPicker: () => void;
  onOpenGrid: () => void;
}) {
  const { reactToComment, showToast } = useStore();
  const holdTimer = useRef<number | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const heldFired = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const openHere = (fromHold: boolean) => {
    // Anchor the picker ABOVE the card, flipping below only when the card is
    // too close to the list's top edge for it to fit.
    let dir: "up" | "down" = "up";
    const el = wrapRef.current;
    const list = el?.closest(".cmt-list");
    if (el && list && el.getBoundingClientRect().top - list.getBoundingClientRect().top < 66) dir = "down";
    navigator.vibrate?.(10);
    onOpenPicker(dir, fromHold);
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
      openHere(true);
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
    else openHere(false);
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
    // The held row floats ABOVE the dim layer, so a tap landing inside the row
    // but beside the bubble (avatar, name, the empty space right of a short
    // card) never reaches the dim — close from the row itself. The card /
    // picker / pill handle (and stop) their own clicks.
    <div
      className={`cmt${c.mine ? " mine" : ""}${picker ? " held-row" : ""}`}
      onClick={() => {
        if (picker) onDismissPicker();
      }}
    >
      <div className="cmt-ava">{initials(c.name)}</div>
      <div className="cmt-b">
        <div className="cmt-h">
          <span className="cmt-name">{c.mine ? "You" : c.name}</span>
          <span className="cmt-time">{c.tm}</span>
        </div>
        <div className={`cmt-cardwrap${c.reactions.length ? " has-rx" : ""}`} ref={wrapRef}>
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
            <motion.button
              className={`cmt-tapback${c.myEmoji ? " mine" : ""}`}
              onClick={whoReacted}
              aria-label="Who reacted"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 520, damping: 24 }}
            >
              {c.reactions.slice(0, 3).map((g) => (
                <span className="tb-e" key={g.emoji}>
                  {g.emoji}
                </span>
              ))}
              <span className="tb-n">{total}</span>
            </motion.button>
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
                {/* A grid-picked reaction outside the base five shows here as a
                    selected sixth chip — tapping it takes the tapback off. */}
                {c.myEmoji && !TAPBACKS.includes(c.myEmoji) && (
                  <motion.button
                    key={c.myEmoji}
                    className="sel"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 640, damping: 22, delay: 0.02 + TAPBACKS.length * 0.026 }}
                    onClick={() => pick(c.myEmoji!)}
                  >
                    {c.myEmoji}
                  </motion.button>
                )}
                <motion.button
                  key="plus"
                  className="plus"
                  aria-label="More emoji"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 640, damping: 22, delay: 0.02 + (TAPBACKS.length + 1) * 0.026 }}
                  onClick={onOpenGrid}
                >
                  ＋
                </motion.button>
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
  const { commentSheet, commentsByWorkout, feed, addComment, reactToComment } = useStore();
  // Keep the last non-null id so the thread stays rendered during exit animation.
  const snap = useRef(commentSheet);
  if (commentSheet) snap.current = commentSheet;
  const workoutId = snap.current;
  const [text, setText] = useState("");
  const [pickerFor, setPickerFor] = useState<{ id: string; dir: "up" | "down" } | null>(null);
  /** Comment id the full emoji grid (＋) is open for. */
  const [gridFor, setGridFor] = useState<string | null>(null);
  // The finger-release that completed the long-press also produces a click —
  // ignore backdrop dismissals within a beat of the picker opening.
  const pickerOpenedAt = useRef(0);
  const dismissPicker = () => {
    if (Date.now() - pickerOpenedAt.current > 400) setPickerFor(null);
  };
  const openPicker = (id: string, dir: "up" | "down", guarded: boolean) => {
    // Only a HOLD-open needs the release-click guard; a tap-open has already
    // consumed its click, so outside taps may dismiss immediately.
    pickerOpenedAt.current = guarded ? Date.now() : 0;
    setPickerFor({ id, dir });
  };

  const comments = workoutId ? commentsByWorkout.get(workoutId) ?? [] : [];
  const item = workoutId ? feed.find((f) => f.id === workoutId) : undefined;

  // Keyboard handling: when the composer focuses, the on-screen keyboard
  // shrinks the visual viewport but NOT the layout viewport — a fixed-bottom
  // sheet would sit behind it. Ride the visualViewport: lift the sheet by the
  // keyboard height (and shrink it so the top stays on screen), with a CSS
  // transition doing the smoothing.
  const sheetRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    const el = sheetRef.current;
    if (!vv || !el) return;
    const apply = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      el.style.bottom = `${kb}px`;
      const avail = window.innerHeight - kb;
      const want = Math.round(window.innerHeight * 0.62);
      el.style.height = `${Math.min(want, avail - 16)}px`;
    };
    apply();
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    return () => {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
    };
  }, []);

  const send = () => {
    const t = text.trim();
    if (!t || !workoutId) return;
    addComment(workoutId, t);
    setText("");
  };

  return (
    <motion.div
      ref={sheetRef}
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
              onOpenPicker={(dir, fromHold) => openPicker(c.id, dir, fromHold)}
              onClosePicker={() => setPickerFor(null)}
              onDismissPicker={dismissPicker}
              onOpenGrid={() => {
                setPickerFor(null);
                setGridFor(c.id);
              }}
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
        {(pickerFor || gridFor) && (
          <motion.div
            className="cmt-dim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={() => {
              if (gridFor) setGridFor(null);
              else dismissPicker();
            }}
          />
        )}
      </AnimatePresence>

      {/* ＋ → full WhatsApp-style emoji grid sliding over the sheet's lower half */}
      <AnimatePresence>
        {gridFor && (
          <EmojiPicker
            selected={comments.find((x) => x.id === gridFor)?.myEmoji}
            onPick={(emoji) => {
              const target = comments.find((x) => x.id === gridFor);
              reactToComment(gridFor, emoji);
              navigator.vibrate?.(8);
              if (target?.myEmoji !== emoji) fx.emojiRain(emoji);
              setGridFor(null);
            }}
            onClose={() => setGridFor(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
