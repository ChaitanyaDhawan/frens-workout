"use client";

import { useRef, useState } from "react";
import { motion } from "motion/react";
import { useStore } from "@/app/lib/store";
import { DEFAULTS } from "@/app/lib/data";
import { fmtDate } from "@/app/lib/helpers";

const DURATIONS = ["30 min", "45 min", "60 min", "90+"];
const SHEET_EASE: [number, number, number, number] = [0.3, 1.15, 0.35, 1];

/** Log / edit sheet — activity chips, duration, note, proof photo. */
export default function DetailSheet() {
  const { sheet, dayData, recents, addRecent, saveDetails, showToast } = useStore();
  // Keep the last non-null sheet so we don't crash during AnimatePresence exit,
  // when the store's `sheet` has already gone null but this is still animating out.
  const snap = useRef(sheet);
  if (sheet) snap.current = sheet;
  const doy = snap.current?.doy ?? 0;
  const mode = snap.current?.mode ?? "log";
  const existing = dayData[doy];

  const [types, setTypes] = useState<string[]>(existing?.types ?? []);
  const [dur, setDur] = useState<string | null>(existing?.dur ?? null);
  const [note, setNote] = useState<string>(existing?.note ?? "");
  const [photo, setPhoto] = useState<boolean>(existing?.photo ?? false);
  const [file, setFile] = useState<File | null>(null);
  const [customShown, setCustomShown] = useState(false);
  const [customVal, setCustomVal] = useState("");
  const customRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const toggleType = (t: string) =>
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const chipList = [
    ...recents.map((t) => ({ t, star: true })),
    ...DEFAULTS.filter((t) => !recents.includes(t)).map((t) => ({ t, star: false })),
  ];

  const submitCustom = () => {
    const t = customVal.trim();
    if (!t) return;
    addRecent(t);
    setTypes((prev) => (prev.includes(t) ? prev : [...prev, t]));
    setCustomVal("");
    setCustomShown(false);
    showToast(`“${t.toUpperCase()}” saved — appears first next time`);
  };

  const onSave = () => saveDetails({ types, dur, note: note.trim(), photo }, file);

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (f) {
      setFile(f);
      setPhoto(true);
    }
  };

  return (
    <motion.div
      className="sheet"
      style={{ x: "-50%" }}
      initial={{ y: "105%" }}
      animate={{ y: 0 }}
      exit={{ y: "105%" }}
      transition={{ duration: 0.4, ease: SHEET_EASE }}
    >
      <div className="shead">
        {mode === "log" ? (
          <h2>
            Log your workout
          </h2>
        ) : (
          <h2>Edit entry</h2>
        )}
        {mode === "log" && <div className="cheat">Do not cheat</div>}
      </div>
      <div className="sub2">{mode === "log" ? "Add details, or just hit log — your call" : fmtDate(doy)}</div>

      <div className="sec">Activity</div>
      <div className="chips">
        {chipList.map(({ t, star }) => (
          <button
            key={t}
            className={`chip${types.includes(t) ? " on" : ""}`}
            data-t={t}
            onClick={() => toggleType(t)}
          >
            {star && <span className="star">★</span>}
            {t}
          </button>
        ))}
        {!customShown && (
          <button
            className="chip addchip"
            onClick={() => {
              setCustomShown(true);
              requestAnimationFrame(() => customRef.current?.focus());
            }}
          >
            ＋ Add your own
          </button>
        )}
        <input
          ref={customRef}
          className={`custom-in${customShown ? " show" : ""}`}
          placeholder="NAME IT…"
          maxLength={18}
          value={customVal}
          onChange={(e) => setCustomVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitCustom();
          }}
        />
      </div>

      <div className="sec">Duration</div>
      <div className="chips">
        {DURATIONS.map((d) => (
          <button
            key={d}
            className={`chip${dur === d ? " on" : ""}`}
            onClick={() => setDur((cur) => (cur === d ? null : d))}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="sec">
        Note <span style={{ color: "#B8B09C", letterSpacing: ".1em" }}>· optional</span>
      </div>
      <div className="noterow">
        <input
          className="note-in"
          placeholder="For the record…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div className="sec">
        Proof photo <span style={{ color: "#B8B09C", letterSpacing: ".1em" }}>· optional</span>
      </div>
      <button className={`photozone${photo ? " got" : ""}`} onClick={() => photoRef.current?.click()}>
        {photo
          ? `✓  ${file ? file.name.toUpperCase() : "SHOWING OFF"}`
          : "＋  Add proof — or show off 💪"}
      </button>
      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={onPickPhoto}
      />

      <div className="btnrow">
        <button className="savebtn" onClick={onSave}>
          {mode === "log" ? "Log it 💪" : "Update entry"}
        </button>
      </div>
    </motion.div>
  );
}
