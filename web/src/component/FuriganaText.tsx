import type { Furi } from "../parse";

interface Props {
  tokens: Furi[];
  showFurigana?: boolean;
}

export default function FuriganaText({ tokens, showFurigana = true }: Props) {
  return (
    <span className="leading-loose">
      {tokens.map((t, i) =>
        t.ruby && showFurigana ? (
          <ruby key={i}>
            {t.text}
            <rt className="text-xs text-slate-500">{t.ruby}</rt>
          </ruby>
        ) : (
          <span key={i}>{t.text}</span>
        )
      )}
    </span>
  );
}