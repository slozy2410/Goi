import { useState } from "react";
import type { Word } from "../types";
import { getExamples, getRelated } from "../parse";
import FuriganaText from "./FuriganaText";

interface Props {
  w: Word;
  furi: boolean;
}

export default function WordCard({ w, furi }: Props) {
  const [ open, setOpen ] = useState(false);
  const examples = getExamples(w);
  const related = getRelated(w);

  return (
    <div
    onClick={() => setOpen(!open)}
    className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-baseline justify-between">
        <div className="text-3xl font-bold text-slate-900">{w.word}</div>
        <div className="text-xs text-slate-400">{open ? "▲" : "▼"}</div>
      </div>
      {furi && <>
      <div className="text-slate-500">{w.reading}</div>
      <div className="mt-1 text-xs font-semibold text-red-600">{w.hanviet}</div>
       <div className="mt-2 text-slate-800">{w.meaning}</div>
</>
}
      {open && (
        <div className="mt-4 space-y-4 border-t border-slate-300 pt-4">{examples.length > 0 && (
          <section>
            <h3 className="mb-1 text-sm font-semibold text-slate-600">VD</h3>
            <ul className="space-y-2">
              {examples.map((ex,i) => (
                <li key={i}>
                  <div className="text-lg text-slate-900">
                    <FuriganaText tokens={ex.tokens} />
                  </div>
                  <div className="text-sm text-slate-500">{ex.vi}</div>
                </li>
              ))}
            </ul>
          </section>
        )}
        
        {related.length > 0 && (
            <section>
              <h3 className="mb-1 text-sm font-semibold text-slate-600">Từ liên quan</h3>
              <ul className="space-y-2">
                {related.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="h-6 w-6 shrink-0 rounded bg-slate-100 text-center text-sm leading-6">
                      {r.label}
                    </span>
                    <div>
                      <div className="text-slate-900">{r.text}</div>
                      {r.vi && <div className="text-sm text-slate-500">{r.vi}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

        </div>
      )}
    </div>
  );
}