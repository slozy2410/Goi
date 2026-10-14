import { useEffect, useState } from "react";
import type { Word } from "../types";
import { getExamples } from "../parse";
import FuriganaText from "./FuriganaText";
import Button from "./Button";

interface Props {
  words: Word[];
  onClose: () => void;
}

// Xáo trộn mảng (Fisher–Yates), trả về mảng mới
function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Flashcard({ words, onClose }: Props) {
  const [deck, setDeck] = useState(words);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const w = deck[index];
  const examples = w ? getExamples(w).slice(0, 2) : [];

  const go = (step: number) => {
    setIndex((i) => Math.min(Math.max(i + step, 0), deck.length - 1));
    setFlipped(false);
  };

  const shuffle = () => {
    setDeck(shuffled(words));
    setIndex(0);
    setFlipped(false);
  };

  // Phím tắt: ← → chuyển thẻ, Space/Enter lật thẻ, Esc đóng
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Khoá cuộn trang phía sau khi đang mở flashcard
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  if (!w) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4"
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg space-y-4">
        <div className="flex items-center justify-between text-white">
          <span className="text-sm">
            Unit {w.unit} · {index + 1} / {deck.length}
          </span>
          <div className="flex gap-3 text-sm">
            <button onClick={shuffle} className="cursor-pointer hover:text-red-300">🔀 Xáo trộn</button>
            <button onClick={onClose} className="cursor-pointer hover:text-red-300">✕ Đóng</button>
          </div>
        </div>

        <div className="h-1 overflow-hidden rounded bg-white/30">
          <div className="h-full bg-red-500 transition-all" style={{ width: `${((index + 1) / deck.length) * 100}%` }} />
        </div>

        <div
          onClick={() => setFlipped(!flipped)}
          className="flex min-h-80 cursor-pointer flex-col items-center justify-center rounded-2xl bg-white p-6 text-center shadow-xl"
        >
          <div className="text-xs text-slate-400">No. {w.no}</div>
          <div className="mt-2 text-5xl font-bold text-slate-900">{w.word}</div>

          {flipped ? (
            <div className="mt-4 w-full space-y-3 border-t border-slate-200 pt-4">
              <div className="text-xl text-slate-500">{w.reading}</div>
              {w.hanviet && <div className="text-sm font-semibold text-red-600">{w.hanviet}</div>}
              {w.meaning && <div className="text-lg text-slate-800">{w.meaning}</div>}
              {examples.length > 0 && (
                <ul className="space-y-2 text-left">
                  {examples.map((ex, i) => (
                    <li key={i}>
                      <div className="text-slate-900"><FuriganaText tokens={ex.tokens} /></div>
                      <div className="text-sm text-slate-500">{ex.vi}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="mt-6 text-sm text-slate-400">Bấm vào thẻ hoặc nhấn Space để lật</div>
          )}
        </div>

        <div className="flex justify-between">
          <Button onClick={() => go(-1)} className={index === 0 ? "invisible" : ""}>← Trước</Button>
          <Button onClick={() => go(1)} className={index === deck.length - 1 ? "invisible" : ""}>Sau →</Button>
        </div>
      </div>
    </div>
  );
}
