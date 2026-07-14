"use client";

import { useStore } from "@/app/lib/store";

export default function DemoButton() {
  const { tab, demoLog } = useStore();
  if (tab === "you") return null;
  return (
    <button className="demo" onClick={demoLog}>
      ▶ demo: friend logs
    </button>
  );
}
