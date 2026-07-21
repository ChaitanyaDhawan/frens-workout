"use client";

import { useEffect } from "react";
import { motion, useMotionValue, useTransform } from "motion/react";
import { useStore } from "@/app/lib/store";

/** Full-screen proof-photo viewer: dark room, the photo whole (contain), a
 *  clear ‹ Back on top. iOS-style gestures: drag the photo down (or up) — it
 *  follows the finger while the room fades; release far or fast enough and it
 *  dismisses, otherwise it springs back. Backdrop tap and Escape also close. */
export default function PhotoViewer() {
  const { photoView, closePhoto } = useStore();
  const y = useMotionValue(0);
  // The room fades and the photo shrinks slightly as it's pulled away.
  const roomOpacity = useTransform(y, [-260, 0, 260], [0.25, 1, 0.25]);
  const dragScale = useTransform(y, [-260, 0, 260], [0.88, 1, 0.88]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePhoto();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closePhoto]);

  if (!photoView) return null;

  return (
    <motion.div
      className="photo-view"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.16 } }}
      transition={{ duration: 0.2 }}
      onClick={closePhoto}
    >
      <motion.div className="pv-room" style={{ opacity: roomOpacity }} />
      <div className="pv-top">
        <button
          className="pv-back"
          onClick={(e) => {
            e.stopPropagation();
            closePhoto();
          }}
        >
          ‹ Back
        </button>
        {photoView.caption && <span className="pv-cap">{photoView.caption}</span>}
      </div>
      <motion.img
        className="pv-img"
        src={photoView.url}
        alt="Proof photo"
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.85}
        style={{ y, scale: dragScale }}
        initial={{ scale: 0.92 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        onDragEnd={(_, info) => {
          // Far enough or flung — dismiss; otherwise motion springs it back.
          if (Math.abs(info.offset.y) > 130 || Math.abs(info.velocity.y) > 750) closePhoto();
        }}
        onClick={(e) => e.stopPropagation()}
      />
    </motion.div>
  );
}
