import type { Word } from "../types";

interface Props {
  unit: number;
  words: Word[];
  onClick: () => void;
}

export default function LessonCard({ unit, words, onClick }: Props) {
  const first = words[0]?.no;
  const last = words[words.length - 1]?.no;
  const preview = words.slice(0, 4).map((w) => w.word);

  return (
    <button
      onClick={onClick}
      className="group flex w-full cursor-pointer flex-col rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-red-300 hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <span className="rounded-md bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
          Unit {unit}
        </span>
        <span className="text-xs text-slate-400">{words.length} từ</span>
      </div>
      <div className="mt-3 text-sm text-slate-500">
        {first !== undefined ? `No. ${first} – ${last}` : "Đang tải..."}
      </div>
      <div className="mt-1 truncate text-lg font-semibold text-slate-900">
        {preview.join("・")}
      </div>
    </button>
  );
}
