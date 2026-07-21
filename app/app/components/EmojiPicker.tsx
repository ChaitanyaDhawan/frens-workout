"use client";

import { useState } from "react";
import { motion } from "motion/react";

// Curated full-picker set, WhatsApp-style categories. (The web has no API to
// summon the OS emoji picker, so chat apps ship their own grid — as do we.)
const CATS: { ic: string; label: string; list: string }[] = [
  {
    ic: "😀",
    label: "Smileys",
    list: "😀😁😂🤣😅😆😊😇🙂😉😍🥰😘😗😙😚😋😛😜🤪😝🤑🤗🤭🤫🤔🫡🤐🤨😐😑😶😏😒🙄😬🤥😌😔😪🤤😴😷🤒🤕🤢🤮🤧🥵🥶🥴😵🤯🤠🥳🥸😎🤓🧐😕😟🙁😮😯😲😳🥺🥹😦😧😨😰😥😢😭😱😖😣😞😓😩😫🥱😤😡😠🤬😈💀🤡👻👽🤖",
  },
  {
    ic: "👋",
    label: "Gestures",
    list: "👋🤚🖐✋🖖👌🤌🤏✌🤞🫰🤟🤘🤙👈👉👆👇☝🫵👍👎✊👊🤛🤜👏🙌🫶👐🤲🤝🙏✍💅🤳💪🦾🦵🦶👂👃🧠👀👅👄",
  },
  {
    ic: "❤️",
    label: "Hearts & hype",
    list: "❤️🧡💛💚💙💜🖤🤍🤎💔❣️💕💞💓💗💖💘💝🔥✨⭐🌟💫💥💢💦💨💬💭💤🎉🎊🎈🎂🎁🏆🥇🥈🥉🏅🎖👑💎🫡💯",
  },
  {
    ic: "⚽",
    label: "Sport",
    list: "⚽🏀🏈⚾🥎🎾🏐🏉🥏🎱🪀🏓🏸🏒🏑🥍🏏🥅⛳🪁🏹🎣🤿🥊🥋🎽🛹🛼🛷⛸🥌🎿⛷🏂🏋🤼🤸⛹🤺🤾🏌🏇🧘🏄🏊🤽🚣🧗🚴🚵🏃🚶🧎",
  },
  {
    ic: "🍕",
    label: "Food",
    list: "🍕🍔🍟🌭🍿🥓🥚🍳🧇🥞🍞🥐🥨🧀🥗🥙🥪🌮🌯🍖🍗🥩🥟🍱🍜🍣🍤🥘🍲🥣🍝🍦🍧🍨🍩🍪🎂🍰🧁🥧🍫🍬🍭🍮🍯🥛☕🍵🍾🍷🍸🍹🍺🍻🥂🥤🧋🧃🧊",
  },
  {
    ic: "🐶",
    label: "Nature",
    list: "🐶🐱🐭🐹🐰🦊🐻🐼🐨🐯🦁🐮🐷🐸🐵🙈🙉🙊🐔🐧🐦🐤🦆🦅🦉🐺🐴🦄🐝🐛🦋🐌🐞🐢🐍🦎🦖🐙🦑🦐🦞🦀🐡🐠🐟🐬🐳🐋🦈🐘🦒🌵🎄🌲🌳🌴🌱🌿🍀🍃🍂🍁💐🌷🌹🌺🌸🌼🌻🌞🌝🌙⭐🌈☀️⛅☁️🌧⛈❄️☃️🌊💧",
  },
];

/** WhatsApp-style full emoji panel: slides up over the sheet's lower half,
 *  category tabs on top, scrollable grid below. */
export default function EmojiPicker({ onPick, onClose }: { onPick: (e: string) => void; onClose: () => void }) {
  const [cat, setCat] = useState(0);
  // Split the category string into individual emoji (grapheme-aware).
  let emojis: string[];
  try {
    const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment: (s: string) => Iterable<{ segment: string }> } }).Segmenter;
    emojis = Seg
      ? [...new Seg(undefined, { granularity: "grapheme" }).segment(CATS[cat].list)].map((s) => s.segment)
      : [...CATS[cat].list];
  } catch {
    emojis = [...CATS[cat].list];
  }

  return (
    <motion.div
      className="emopanel"
      initial={{ y: "108%" }}
      animate={{ y: 0 }}
      exit={{ y: "108%", transition: { duration: 0.18 } }}
      transition={{ type: "spring", stiffness: 380, damping: 34 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="emo-tabs">
        {CATS.map((c, i) => (
          <button
            key={c.ic}
            className={i === cat ? "on" : ""}
            aria-label={c.label}
            onClick={() => setCat(i)}
          >
            {c.ic}
          </button>
        ))}
        <button className="emo-x" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <div className="emo-grid">
        {emojis.map((e) => (
          <button key={e} onClick={() => onPick(e)}>
            {e}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
