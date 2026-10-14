export interface Word {
    unit: number;
    no: number;
    word: string;
    reading: string;
    hanviet: string;
    meaning: string;
    examples_jp: string;
    examples_furigana: string;
    examples_vi: string;
    related: string;
}

// Bài đọc do AI tạo (khớp với OUTPUT_SCHEMA trong server/readingApi.ts)
export interface ReadingQuestion {
    question: string;
    options: string[];
    answer: number;
    explanation_vi: string;
}

export interface Reading {
    title: string;
    passage_furigana: string;
    translation_vi: string;
    used_words: { word: string; meaning_vi: string }[];
    questions: ReadingQuestion[];
}
