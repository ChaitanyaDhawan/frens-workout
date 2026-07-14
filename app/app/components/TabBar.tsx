"use client";

import { useStore, type TabId } from "@/app/lib/store";

const TABS: { v: TabId; label: string }[] = [
  { v: "home", label: "Home" },
  { v: "board", label: "Board" },
  { v: "you", label: "You" },
];

export default function TabBar() {
  const { tab, setTab } = useStore();
  return (
    <nav className="tabbar">
      {TABS.map(({ v, label }) => (
        <button
          key={v}
          className={`tb${tab === v ? " active" : ""}`}
          data-v={v}
          onClick={() => setTab(v)}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
