"use client";

import { useState } from "react";
import { isKudosSoundOn, setKudosSoundOn, playKudos } from "@/app/lib/sound";

/** Settings row to mute/unmute the kudos applause. Turning it on plays a quick
 *  preview so you hear what you're getting. */
export default function KudosSoundTile() {
  const [on, setOn] = useState<boolean>(() => isKudosSoundOn());

  const toggle = () => {
    const next = !on;
    setOn(next);
    setKudosSoundOn(next);
    if (next) playKudos(); // preview the applause on enable
  };

  return (
    <button className="al-entry notif-tile" onClick={toggle}>
      <span className="al-entry-ic">{on ? "🔊" : "🔇"}</span>
      <span className="al-entry-tx">
        <span className="al-entry-t">Kudos sound</span>
        <span className="al-entry-s">{on ? "Applause when kudos land" : "Kudos stay silent"}</span>
      </span>
      <span className={`notif-pill${on ? " on" : ""}`}>{on ? "ON" : "OFF"}</span>
    </button>
  );
}
