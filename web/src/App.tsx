import { useEffect, useState } from "react";
import type { Word } from "./types";
import WordCard from "./component/WordCard";
import Button from "./component/Button";


export default function App(){
  const [words, setWords] = useState<Word[]>([])
  const [ furi, setFuri ] = useState(false);

  useEffect(() => {
    fetch("/unit-1.json")
    .then((res) => res.json())
    .then((data: Word[]) => setWords(data));
  },[]);

  return (
    <main className="mx-auto max-w-xl space-y-3 px-4 py-8">
      <h1 className="text-2xl font-bold">Mimikara N1 - Unit 1</h1>
      <Button onClick={() => setFuri(!furi)}>Hiển thị furigana</Button>
      {words.map((w) => (
        <WordCard key={w.no} w={w} furi={furi}/>
      ))}
    </main>
  )
}