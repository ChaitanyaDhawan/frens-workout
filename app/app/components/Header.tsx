"use client";

import { useStore } from "@/app/lib/store";

export default function Header() {
  const { me } = useStore();
  return (
    <header>
      <div className="eyebrow">Est. 2025 · 13 athletes</div>
      <div className="wordmark">
        FRENS WORKOUT
      </div>
      <div className="owner">{me.name}&rsquo;s records</div>
    </header>
  );
}
