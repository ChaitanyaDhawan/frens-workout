"use client";

import { useEffect, useState } from "react";

// Temporary approval tool: open the app with ?pick=1 to compare background
// shades live on the real screens. The chosen shade persists locally so you can
// tab around the app and keep comparing. Removed once a shade is locked in.
const OPTIONS = [
  { id: "linen", name: "Linen", paper: "#F4F2ED", card: "#FBFAF6" },
  { id: "cool", name: "Cool", paper: "#F1F2F4", card: "#FCFCFB" },
  { id: "ivory", name: "Ivory", paper: "#F9F6EF", card: "#FFFFFF" },
  { id: "grey", name: "Grey", paper: "#EFEFEE", card: "#FAFAF9" },
  { id: "orig", name: "Original", paper: "#F3EFE6", card: "#FAF7F0" },
];

export default function BackgroundPicker() {
  const [show, setShow] = useState(false);
  const [sel, setSel] = useState<string | null>(null);

  const apply = (id: string) => {
    const o = OPTIONS.find((x) => x.id === id);
    if (!o) return;
    document.documentElement.style.setProperty("--paper", o.paper);
    document.documentElement.style.setProperty("--card", o.card);
    localStorage.setItem("frens-bg", id);
    setSel(id);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const on = new URLSearchParams(window.location.search).has("pick");
    setShow(on);
    if (on) {
      const saved = localStorage.getItem("frens-bg");
      if (saved) apply(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!show) return null;

  return (
    <div className="bgpick">
      <span className="bgpick-lbl">Background</span>
      {OPTIONS.map((o) => (
        <button key={o.id} className={`bgpick-b${sel === o.id ? " on" : ""}`} onClick={() => apply(o.id)}>
          {o.name}
        </button>
      ))}
    </div>
  );
}
