"use client";

import { motion } from "motion/react";
import { useStore } from "@/app/lib/store";
import { useAuth } from "@/app/lib/auth";
import NotifTile from "./NotifTile";
import KudosSoundTile from "./KudosSoundTile";

const EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];

/** Right-side settings drawer — auto-logging, notifications, sign out. Opens
 *  from the gear in the You tab and slides in from the right edge. */
export default function SettingsDrawer() {
  const { closeSettings, openAutoLog } = useStore();
  const { member, signOut } = useAuth();

  return (
    <motion.div
      className="set-drawer"
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ duration: 0.34, ease: EASE }}
    >
      <div className="set-head">
        <h2>Settings</h2>
        <button className="set-x" onClick={closeSettings} aria-label="Close">
          ✕
        </button>
      </div>

      <div className="set-group">
        <button
          className="al-entry"
          onClick={() => {
            closeSettings();
            openAutoLog();
          }}
        >
          <span className="al-entry-ic">⚡</span>
          <span className="al-entry-tx">
            <span className="al-entry-t">Auto-logging</span>
            <span className="al-entry-s">Apple Watch &amp; more</span>
          </span>
          <span className="al-entry-arrow">›</span>
        </button>
        <NotifTile />
        <KudosSoundTile />
      </div>

      <div className="set-foot">
        {member && <div className="set-who">Signed in as {member.display_name}</div>}
        <button className="set-signout" onClick={() => signOut()}>
          Sign out
        </button>
      </div>
    </motion.div>
  );
}
