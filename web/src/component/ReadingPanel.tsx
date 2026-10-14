import { useEffect, useState } from "react";
import type { Reading, Word } from "../types";
import { parseFurigana } from "../parse";
import FuriganaText from "./FuriganaText";
import Button from "./Button";

interface Props {
  words: Word[];
  title: string;
  onClose: () => void;
}

const COUNTS = [8, 12, 16, 20];

// Khớp với TYPE_SPECS trong server/readingApi.ts
const TYPES = [
  { id: "chuubun", label: "中文 · bài trung", hint: "1000–1500 chữ" },
  { id: "choubun", label: "長文 · bài dài", hint: "2500–3500 chữ" },
] as const;

// Đếm số ký tự của bài, bỏ phần furigana trong ngoặc và xuống dòng
const countChars = (s: string) => s.replace(/[（(][^）)]*[）)]/g, "").replace(/\s/g, "").length;

function pickRandom(words: Word[], n: number): Word[] {
  const a = [...words];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

export default function ReadingPanel({ words, title, onClose }: Props) {
  const [type, setType] = useState<(typeof TYPES)[number]["id"]>("chuubun");
  const [count, setCount] = useState(12);
  const [picked, setPicked] = useState(() => pickRandom(words, 12));
  const [reading, setReading] = useState<Reading | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [furi, setFuri] = useState(true);
  const [showVi, setShowVi] = useState(false);
  // Đáp án người dùng chọn cho từng câu hỏi
  const [chosen, setChosen] = useState<Record<number, number>>({});

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const reroll = (n = count) => {
    setCount(n);
    setPicked(pickRandom(words, n));
  };

  const generate = async () => {
    setLoading(true);
    setError("");
    setReading(null);
    setChosen({});
    setShowVi(false);
    try {
      const res = await fetch("/api/reading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, words: picked.map((w) => ({ word: w.word, reading: w.reading })) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Lỗi ${res.status}`);
      setReading(data as Reading);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 px-4 py-8">
      <div
        onClick={(e) => e.stopPropagation()}
        className="mx-auto max-w-2xl space-y-5 rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">📖 Bài đọc hiểu · {title}</h2>
          <button onClick={onClose} className="cursor-pointer text-slate-400 hover:text-red-500">✕</button>
        </div>

        {/* Chọn bộ từ vựng */}
        <section className="space-y-3 rounded-xl bg-slate-50 p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-600">Dạng bài:</span>
            {TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => setType(t.id)}
                className={`cursor-pointer rounded-md px-2 py-0.5 ${t.id === type ? "bg-red-500 text-white" : "bg-white text-slate-700 hover:bg-red-100"}`}
              >
                {t.label} <span className="opacity-70">({t.hint})</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-600">Số từ:</span>
            {[...COUNTS.filter((n) => n < words.length), words.length].map((n) => (
              <button
                key={n}
                onClick={() => reroll(n)}
                className={`cursor-pointer rounded-md px-2 py-0.5 ${n === count ? "bg-red-500 text-white" : "bg-white text-slate-700 hover:bg-red-100"}`}
              >
                {n === words.length ? `Tất cả (${n})` : n}
              </button>
            ))}
            <button onClick={() => reroll()} className="ml-auto cursor-pointer text-slate-500 hover:text-red-500">
              🔀 Đổi bộ từ
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {picked.map((w) => (
              <span key={w.no} className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-sm">
                {w.word}
              </span>
            ))}
          </div>
          <Button onClick={generate} className={loading ? "pointer-events-none opacity-60" : ""}>
            {loading ? "Đang tạo bài đọc..." : reading ? "Tạo bài khác" : "✨ Tạo bài đọc"}
          </Button>
          {loading && <p className="text-sm text-slate-500">AI đang viết bài, bài dài có thể mất 1–2 phút.</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </section>

        {reading && (
          <>
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg font-bold">{reading.title}</h3>
                  <div className="text-xs text-slate-400">{countChars(reading.passage_furigana)} chữ</div>
                </div>
                <div className="flex shrink-0 gap-3 text-sm">
                  <button onClick={() => setFuri(!furi)} className="cursor-pointer text-slate-500 hover:text-red-500">
                    {furi ? "Ẩn furigana" : "Hiện furigana"}
                  </button>
                  <button onClick={() => setShowVi(!showVi)} className="cursor-pointer text-slate-500 hover:text-red-500">
                    {showVi ? "Ẩn bản dịch" : "Xem bản dịch"}
                  </button>
                </div>
              </div>
              <div className="space-y-3 text-lg text-slate-900">
                {reading.passage_furigana.split("\n").filter(Boolean).map((p, i) => (
                  <p key={i}><FuriganaText tokens={parseFurigana(p)} showFurigana={furi} /></p>
                ))}
              </div>
              {showVi && (
                <div className="space-y-2 border-l-4 border-red-200 pl-3 text-slate-600">
                  {reading.translation_vi.split("\n").filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
                </div>
              )}
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-slate-600">Từ vựng đã dùng ({reading.used_words.length})</h3>
              <ul className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
                {reading.used_words.map((u, i) => (
                  <li key={i}><span className="font-semibold">{u.word}</span> <span className="text-slate-500">– {u.meaning_vi}</span></li>
                ))}
              </ul>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-600">Câu hỏi đọc hiểu</h3>
              {reading.questions.map((q, qi) => {
                const pick = chosen[qi];
                const answered = pick !== undefined;
                return (
                  <div key={qi} className="space-y-2">
                    <p className="font-medium">問{qi + 1}. {q.question}</p>
                    <div className="space-y-1">
                      {q.options.map((opt, oi) => {
                        const style = !answered
                          ? "border-slate-200 hover:border-red-300"
                          : oi === q.answer
                            ? "border-green-500 bg-green-50"
                            : oi === pick
                              ? "border-red-500 bg-red-50"
                              : "border-slate-200 opacity-60";
                        return (
                          <button
                            key={oi}
                            disabled={answered}
                            onClick={() => setChosen({ ...chosen, [qi]: oi })}
                            className={`block w-full cursor-pointer rounded-lg border px-3 py-1.5 text-left disabled:cursor-default ${style}`}
                          >
                            {oi + 1}. {opt}
                          </button>
                        );
                      })}
                    </div>
                    {answered && <p className="text-sm text-slate-600">💡 {q.explanation_vi}</p>}
                  </div>
                );
              })}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
