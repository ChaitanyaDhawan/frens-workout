"use client";

import { useEffect } from "react";
import { motion } from "motion/react";
import { useStore } from "@/app/lib/store";

/** Full-screen proof-photo viewer: dark room, the photo whole (contain), a
 *  clear ‹ Back on top. Backdrop tap or Escape also closes. */
export default function PhotoViewer() {
  const { photoView, closePhoto } = useStore();

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
        initial={{ scale: 0.92 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
      />
    </motion.div>
  );
}
