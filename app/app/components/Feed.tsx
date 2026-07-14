"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/app/lib/store";
import { fx } from "@/app/lib/fx";
import { initials } from "@/app/lib/helpers";
import type { FeedItem } from "@/app/lib/data";

function FeedCard({ item, mountDelay }: { item: FeedItem; mountDelay: number | null }) {
  const { toggleLike, addComment } = useStore();
  const [liked, setLiked] = useState(item.liked ?? false);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Keep in sync if the reaction state changes underneath us (e.g. realtime).
  useEffect(() => {
    setLiked(item.liked ?? false);
  }, [item.liked]);

  const onLike = () => {
    const becoming = !liked;
    setLiked(becoming);
    if (becoming && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      fx.fire(r.left + r.width / 2, r.top + 4);
      navigator.vibrate?.(10);
    }
    toggleLike(item.id, becoming);
  };

  const onComment = () => {
    const body = typeof window !== "undefined" ? window.prompt("Add a comment") : null;
    if (body && body.trim()) addComment(item.id, body.trim());
  };

  const style =
    mountDelay != null ? ({ animation: `cardstag .35s ${mountDelay}ms both` } as React.CSSProperties) : undefined;

  return (
    <div className={`card${item.fresh ? " fresh" : ""}`} style={style}>
      <div className="top">
        <div className="ava">{initials(item.n)}</div>
        <div className="meta">
          <div className="cnm">{item.n}</div>
          <div className="tm">{item.tm}</div>
        </div>
      </div>
      <div className="brag">
        <span className="bact">{item.act || "Workout"}</span>
        <span className="bstat">{item.brag || ""}</span>
      </div>
      {item.note ? <div className="note">{item.note}</div> : null}
      {item.pic ? <div className="pic">PROOF ATTACHED</div> : null}
      <div className="acts">
        <button ref={btnRef} className={`act${liked ? " liked" : ""}`} onClick={onLike}>
          <span className="ico">🔥</span> <span className="lc">{item.likes + (liked ? 1 : 0)}</span>
        </button>
        <button className="act" onClick={onComment}>✎ {item.c} comments</button>
      </div>
    </div>
  );
}

/** Home "Dispatches" feed. First 6 cards stagger in on mount; fresh cards pop. */
export default function Feed() {
  const { feed } = useStore();
  // Fixed per-card delays captured at mount — stable across prepends so the
  // stagger plays once and never re-triggers when the feed changes.
  const [mountDelays] = useState(() => {
    const map = new Map<string, number>();
    feed.slice(0, 6).forEach((f, i) => map.set(f.id, i * 60));
    return map;
  });

  return (
    <div id="feed">
      {feed.map((f) => (
        <FeedCard key={f.id} item={f} mountDelay={mountDelays.get(f.id) ?? null} />
      ))}
    </div>
  );
}
