import { useEffect, useState } from "react";
import type { Word } from "./types";
import WordCard from "./component/WordCard";
import LessonCard from "./component/LessonCard";
import Flashcard from "./component/Flashcard";
import ReadingPanel from "./component/ReadingPanel";
import Button from "./component/Button";

const UNITS = Array.from({ length: 14 }, (_, i) => i + 1);

// Unit đang mở được lưu trên URL (#unit-3) để nút Back của trình duyệt hoạt động
function readUnitFromHash(): number | null {
  const m = window.location.hash.match(/^#unit-(\d+)$/);
  return m ? Number(m[1]) : null;
}

export default function App(){
  const [units, setUnits] = useState<Record<number, Word[]>>({});
  const [current, setCurrent] = useState<number | null>(readUnitFromHash);
  const [ furi, setFuri ] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [reading, setReading] = useState(false);

  useEffect(() => {
    UNITS.forEach((u) => {
      fetch(`/unit-${u}.json`)
      .then((res) => res.json())
      .then((data: Word[]) => setUnits((prev) => ({ ...prev, [u]: data })));
    });
  },[]);

  useEffect(() => {
    const onPop = () => setCurrent(readUnitFromHash());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const openUnit = (u: number | null) => {
    history.pushState(null, "", u === null ? window.location.pathname : `#unit-${u}`);
    setCurrent(u);
    setPlaying(false);
    setReading(false);
    window.scrollTo(0, 0);
  };

  if (current === null) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Mimikara N1 - Từ vựng</h1>
          <Button onClick={() => setPlaying(true)}>▶ Học toàn bộ</Button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {UNITS.map((u) => (
            <LessonCard key={u} unit={u} words={units[u] ?? []} onClick={() => openUnit(u)} />
          ))}
        </div>
        {playing && (
          <Flashcard words={UNITS.flatMap((u) => units[u] ?? [])} onClose={() => setPlaying(false)} />
        )}
      </main>
    );
  }

  const words = units[current] ?? [];

  return (
    <main className="mx-auto max-w-xl space-y-3 px-4 py-8">
      <button onClick={() => openUnit(null)} className="cursor-pointer text-sm text-slate-500 hover:text-red-500">
        ← Danh sách unit
      </button>
      <h1 className="text-2xl font-bold">Mimikara N1 - Unit {current}</h1>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setFuri(!furi)}>{furi ? "Hide hiragana" : "Show hiragana"}</Button>
        <Button onClick={() => setPlaying(true)}>▶ Luyện tập</Button>
        {words.length > 0 && <Button onClick={() => setReading(true)}>📖 Bài đọc AI</Button>}
        {current > 1 && <Button onClick={() => openUnit(current - 1)}>← Unit {current - 1}</Button>}
        {current < UNITS.length && <Button onClick={() => openUnit(current + 1)}>Unit {current + 1} →</Button>}
      </div>
      {words.map((w) => (
        <WordCard key={w.no} w={w} furi={furi}/>
      ))}
      {playing && (
        <Flashcard words={words} onClose={() => setPlaying(false)} />
      )}
      {reading && (
        <ReadingPanel key={current} words={words} title={`Unit ${current}`} onClose={() => setReading(false)} />
      )}
    </main>
  )
}
