"use client";

import { useRef, useState } from "react";
import { motion } from "motion/react";
import { useStore } from "@/app/lib/store";
import { initials } from "@/app/lib/helpers";

const SHEET_EASE: [number, number, number, number] = [0.3, 1.15, 0.35, 1];

/** Bottom-sheet comment thread for a single workout. */
export default function CommentSheet() {
  const { commentSheet, commentsByWorkout, feed, addComment } = useStore();
  // Keep the last non-null id so the thread stays rendered during exit animation.
  const snap = useRef(commentSheet);
  if (commentSheet) snap.current = commentSheet;
  const workoutId = snap.current;
  const [text, setText] = useState("");

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
      {item && <div className="cmt-sub">{`${item.n} · ${item.act ?? "Workout"}`}</div>}

      <div className="cmt-list">
        {comments.length === 0 ? (
          <div className="cmt-empty">No comments yet — start the thread 💬</div>
        ) : (
          comments.map((c) => (
            <div className={`cmt${c.mine ? " mine" : ""}`} key={c.id}>
              <div className="cmt-ava">{initials(c.name)}</div>
              <div className="cmt-b">
                <div className="cmt-h">
                  <span className="cmt-name">{c.mine ? "You" : c.name}</span>
                  <span className="cmt-time">{c.tm}</span>
                </div>
                <div className="cmt-text">{c.body}</div>
              </div>
            </div>
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
