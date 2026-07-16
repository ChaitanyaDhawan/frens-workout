"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useAuth } from "@/app/lib/auth";
import { fx } from "@/app/lib/fx";
import { playKudos } from "@/app/lib/sound";

const CEL_EASE: [number, number, number, number] = [0.2, 1.1, 0.3, 1];

function formatGivers(givers: string[]): string {
  if (givers.length === 1) return givers[0];
  if (givers.length === 2) return `${givers[0]} & ${givers[1]}`;
  if (givers.length === 3) return `${givers[0]}, ${givers[1]} & ${givers[2]}`;
  return `${givers[0]}, ${givers[1]} & ${givers.length - 2} others`;
}

/** On open, celebrates kudos received on my workouts since I last saw them. */
export default function KudosReceived() {
  const { supabase, member } = useAuth();
  const [data, setData] = useState<{ count: number; givers: string[] } | null>(null);

  useEffect(() => {
    if (!member?.id) return;
    let cancelled = false;
    (async () => {
      const { data: meRow } = await supabase.from("members").select("kudos_seen_at").eq("id", member.id).single();
      const seen = meRow?.kudos_seen_at as string | undefined;
      const { data: myW } = await supabase.from("workouts").select("id").eq("member_id", member.id);
      const ids = (myW ?? []).map((w) => w.id as string);
      if (!ids.length) return;
      let q = supabase.from("reactions").select("member_id, created_at").in("workout_id", ids).neq("member_id", member.id);
      if (seen) q = q.gt("created_at", seen);
      const { data: reacts } = await q;
      if (cancelled || !reacts || !reacts.length) return;
      const giverIds = [...new Set(reacts.map((r) => r.member_id as string))];
      const { data: gm } = await supabase.from("members").select("id, display_name").in("id", giverIds);
      const nameById = new Map((gm ?? []).map((m) => [m.id as string, m.display_name as string]));
      const givers = giverIds.map((id) => nameById.get(id) || "Someone");
      setData({ count: reacts.length, givers });
      navigator.vibrate?.([10, 30, 10, 30, 16]);
      // Visual burst on open, but no sound — tapping the badge plays it (audio
      // that autoplays on open startles people, and browsers block it anyway).
      setTimeout(() => {
        fx.clap(window.innerWidth / 2, window.innerHeight * 0.34);
      }, 200);
    })();
    return () => {
      cancelled = true;
    };
  }, [member?.id, supabase]);

  const playApplause = () => {
    if (!data) return;
    playKudos(data.count); // length scales with how many kudos landed
    fx.clap(window.innerWidth / 2, window.innerHeight * 0.34);
    navigator.vibrate?.(12);
  };

  const dismiss = async () => {
    setData(null);
    try {
      await supabase.rpc("mark_kudos_seen");
    } catch {
      /* best-effort — next open will re-show, harmless */
    }
  };

  if (!data) return null;

  return (
    <div className="cel-scrim" role="dialog" aria-modal="true">
      <motion.div
        className="cel"
        initial={{ y: 26, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: CEL_EASE }}
      >
        <div className="cel-eyebrow">While you were out</div>
        <motion.button
          type="button"
          className="cel-badge kudos"
          onClick={playApplause}
          aria-label="Play applause"
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          whileTap={{ scale: 0.92 }}
          transition={{ delay: 0.12, duration: 0.5, ease: [0.2, 1.8, 0.4, 1] }}
        >
          👏
        </motion.button>
        <div className="cel-hear">Tap 👏 to hear</div>
        <h1 className="cel-headline">
          {data.count} new {data.count === 1 ? "kudos" : "kudos"}!
        </h1>
        <div className="cel-sub">from {formatGivers(data.givers)}</div>
        <div className="cel-btns" style={{ marginTop: 30 }}>
          <button className="cel-share" style={{ flex: 1 }} onClick={dismiss}>
            Nice 👏
          </button>
        </div>
      </motion.div>
    </div>
  );
}
