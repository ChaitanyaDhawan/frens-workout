"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/app/lib/auth";
import { initials } from "@/app/lib/helpers";

interface Unclaimed {
  id: string;
  sheet_name: string;
  display_name: string;
}

/** Signed-in-but-unclaimed screen — pick your name to link this account. */
export default function Claim() {
  const { supabase, refreshMember, signOut } = useAuth();
  const [list, setList] = useState<Unclaimed[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("list_unclaimed");
    if (error) setErr("Couldn't load names. Try again.");
    else {
      setErr(null);
      setList((data as Unclaimed[]) ?? []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const claim = async (m: Unclaimed) => {
    setClaiming(m.id);
    setErr(null);
    const { error } = await supabase.rpc("claim_member", { p_member_id: m.id });
    if (error) {
      const msg = error.message || "";
      if (msg.includes("name_taken")) {
        setErr(`${m.display_name} was just taken — pick another.`);
        await load();
      } else if (msg.includes("already_claimed_by_you")) {
        await refreshMember();
      } else {
        setErr("Couldn't claim that name. Try again.");
      }
      setClaiming(null);
      return;
    }
    await refreshMember();
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-eyebrow">One last step</div>
        <div className="auth-mark">
          CLAIM YOUR NAME<i>.</i>
        </div>
        <div className="auth-rule" />
        <p className="auth-sub">Tap your name to link this account. Pick yours.</p>
        {err && <div className="auth-err">{err}</div>}
        {loading ? (
          <div className="auth-loading">Loading names…</div>
        ) : list.length === 0 ? (
          <div className="auth-loading">All names are claimed. Ask an admin to add you.</div>
        ) : (
          <div className="claim-list">
            {list.map((m) => (
              <button key={m.id} className="claim-row" disabled={claiming !== null} onClick={() => claim(m)}>
                <span className="claim-ava">{initials(m.display_name)}</span>
                <span className="claim-name">{m.display_name}</span>
                <span className="claim-cta">{claiming === m.id ? "…" : "Claim →"}</span>
              </button>
            ))}
          </div>
        )}
        <button className="auth-signout" onClick={signOut}>
          Sign out
        </button>
      </div>
    </div>
  );
}
