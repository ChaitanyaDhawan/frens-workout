"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/app/lib/store";
import { fx } from "@/app/lib/fx";
import { playKudos } from "@/app/lib/sound";
import { initials } from "@/app/lib/helpers";
import type { FeedItem } from "@/app/lib/data";

function kudosSummary(names: string[]): string {
  if (names.length === 1) return `${names[0]} gave kudos`;
  if (names.length === 2) return `${names[0]} & ${names[1]} gave kudos`;
  return `${names[0]}, ${names[1]} + ${names.length - 2} gave kudos`;
}

export function FeedCard({
  item,
  mountDelay,
  spotlight,
  priority,
}: {
  item: FeedItem;
  mountDelay: number | null;
  spotlight?: boolean;
  /** Above-the-fold card — load its photo eagerly at high priority. */
  priority?: boolean;
}) {
  const { toggleLike, openCommentSheet, openSheet, openKudosSheet, openProfile } = useStore();
  const [liked, setLiked] = useState(item.liked ?? false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [popKey, setPopKey] = useState(0);
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
      fx.clap(r.left + r.width / 2, r.top + 4);
      setPopKey((k) => k + 1); // restart the "KUDOS!" pop + clap-icon bump
      // Applause + a 👏 stream rising for exactly as long as it plays.
      const dur = playKudos();
      fx.emojiRain("👏", dur);
      navigator.vibrate?.([12, 24, 12]);
    }
    toggleLike(item.id, becoming);
  };

  const onEdit = () => {
    if (item.doy != null) openSheet("edit", item.doy);
  };

  const kudos = item.likes + (liked ? 1 : 0);

  const style =
    mountDelay != null ? ({ animation: `cardstag .35s ${mountDelay}ms both` } as React.CSSProperties) : undefined;

  return (
    <div className={`card${item.fresh ? " fresh" : ""}${spotlight ? " spotlight" : ""}`} style={style} data-fid={item.id}>
      {item.mine && item.doy != null && (
        <button className="card-edit" onClick={onEdit} aria-label="Edit this entry" title="Edit entry">
          ✎
        </button>
      )}
      <div className="top">
        <div className="ava" onClick={() => openProfile(item.n)} style={{ cursor: "pointer" }}>
          {initials(item.n)}
        </div>
        <div className="meta">
          <div className="cnm" onClick={() => openProfile(item.n)} style={{ cursor: "pointer" }}>
            {item.n}
          </div>
          <div className="tm">{item.tm}</div>
        </div>
      </div>
      <div className="brag">
        <span className="bact">{item.act || "Workout"}</span>
        {item.dur ? <span className="bdur">{item.dur}</span> : null}
        <span className="bstat">{item.brag || ""}</span>
      </div>
      {item.note ? <div className="note">{item.note}</div> : null}
      {item.picUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          className={`pic-img${imgLoaded ? " ld" : ""}`}
          src={item.picUrl}
          alt="Proof"
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          decoding="async"
          onLoad={() => setImgLoaded(true)}
        />
      ) : item.pic ? (
        <div className="pic">PROOF ATTACHED</div>
      ) : null}
      {item.likers && item.likers.length > 0 && (
        <div
          className="kudos-from"
          role="button"
          tabIndex={0}
          onClick={() => openKudosSheet(item.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openKudosSheet(item.id);
            }
          }}
        >
          <span className="kf-avas">
            {item.likers.slice(0, 3).map((n, i) => (
              <span className="kf-ava" key={i}>
                {initials(n)}
              </span>
            ))}
          </span>
          <span className="kf-tx">{kudosSummary(item.likers)}</span>
        </div>
      )}
      <div className="acts">
        <button ref={btnRef} className={`act kudos-btn${liked ? " liked" : ""}`} onClick={onLike}>
          <span key={`ico-${popKey}`} className={`ico${popKey > 0 ? " bump" : ""}`}>
            👏
          </span>{" "}
          <span className="lc">{kudos} kudos</span>
          {popKey > 0 && (
            <span key={popKey} className="kudos-pop">
              KUDOS!
            </span>
          )}
        </button>
        <button className="act" onClick={() => openCommentSheet(item.id)}>
          💬 {item.c} {item.c === 1 ? "comment" : "comments"}
        </button>
      </div>
    </div>
  );
}

/** Home "Dispatches" feed. First 6 cards stagger in on mount; fresh cards pop. */
export default function Feed() {
  const { feed, logFocusKey, consumeLogFocus, deepLink, clearDeepLink, openCommentSheet } = useStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [spotlight, setSpotlight] = useState(false);
  const [deepId, setDeepId] = useState<string | null>(null);

  // Notification deep-link (from the store): scroll to + spotlight the card; a
  // kudos tap also fires the 👏 burst on it.
  useEffect(() => {
    if (!deepLink) return;
    // A comment notification opens the thread sheet directly — it doesn't need
    // the card to be within the top-24 feed. (If the collect-kudos screen is
    // up, it overlays the sheet; dismissing it lands you in the thread.)
    if (deepLink.comment) {
      openCommentSheet(deepLink.id);
    }
    const el = containerRef.current?.querySelector(`[data-fid="${deepLink.id}"]`);
    if (!el) {
      if (deepLink.comment) clearDeepLink(); // sheet opened; nothing to scroll to
      return; // card not in the feed yet — re-runs when feed loads
    }
    const isKudos = deepLink.kudos;
    requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "center" }));
    setDeepId(deepLink.id);
    setTimeout(() => setDeepId(null), 2600);
    if (isKudos) {
      // Let the smooth-scroll settle, then pop the ember burst over the card.
      setTimeout(() => {
        const r = el.getBoundingClientRect();
        fx.clap(r.left + r.width * 0.28, r.top + r.height * 0.82);
      }, 650);
    }
    clearDeepLink();
  }, [deepLink, feed, clearDeepLink, openCommentSheet]);

  // Fixed per-card delays captured at mount — stable across prepends so the
  // stagger plays once and never re-triggers when the feed changes.
  const [mountDelays] = useState(() => {
    const map = new Map<string, number>();
    feed.slice(0, 6).forEach((f, i) => map.set(f.id, i * 60));
    return map;
  });

  // After a fresh log: scroll to the newest card and spotlight it briefly.
  useEffect(() => {
    if (!consumeLogFocus()) return;
    setSpotlight(true);
    const raf = requestAnimationFrame(() => {
      containerRef.current?.querySelector(".card")?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    const t = setTimeout(() => setSpotlight(false), 2400);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [logFocusKey, consumeLogFocus]);

  return (
    <div id="feed" ref={containerRef}>
      {feed.map((f, i) => (
        <FeedCard
          key={f.id}
          item={f}
          mountDelay={mountDelays.get(f.id) ?? null}
          spotlight={(spotlight && i === 0) || f.id === deepId}
          priority={i < 2}
        />
      ))}
    </div>
  );
}
