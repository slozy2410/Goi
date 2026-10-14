import { ApiError, FinishReason, GoogleGenAI } from "@google/genai";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

// Middleware chạy trên Vite dev/preview server: trình duyệt gọi POST /api/reading,
// server mới gọi Gemini API, nên API key không bao giờ lộ ra phía client.

interface VocabInput {
  word: string;
  reading: string;
}

// Dạng bài theo đề JLPT N1: 中文 (bài trung bình) và 長文 (bài dài)
export type ReadingType = "chuubun" | "choubun";

const TYPE_SPECS: Record<ReadingType, { label: string; chars: string; paragraphs: string; questions: number }> = {
  chuubun: { label: "中文（ちゅうぶん）", chars: "1000–1500", paragraphs: "4–6", questions: 3 },
  choubun: { label: "長文（ちょうぶん）", chars: "2500–3500", paragraphs: "8–12", questions: 4 },
};

const SYSTEM_PROMPT = `Bạn là giáo viên tiếng Nhật luyện thi JLPT N1 cho người Việt.
Viết một bài đọc hiểu tiếng Nhật trình độ N1, chủ đề kinh doanh (bài báo kinh tế, bình luận/xã luận, tiểu luận về quản trị và lao động, phỏng vấn doanh nhân, báo cáo phân tích thị trường...).
Văn phong như đề đọc hiểu JLPT N1 thật: văn viết trang trọng (である調 hoặc です・ます tuỳ thể loại), lập luận có chiều sâu, có quan điểm của tác giả, có ví dụ cụ thể và kết luận.
Độ dài và số câu hỏi theo dạng bài được yêu cầu trong tin nhắn. Độ dài tính theo số ký tự tiếng Nhật của bài, KHÔNG tính phần furigana trong ngoặc. Tuyệt đối không viết ngắn hơn mức tối thiểu.
Yêu cầu:
- Dùng tự nhiên càng nhiều từ trong danh sách được cho càng tốt (có thể chia động từ/tính từ). Không gượng ép tới mức câu văn mất tự nhiên.
- Trong "passage_furigana", ghi cách đọc hiragana ngay sau MỌI cụm kanji theo dạng 漢字（かんじ） dùng ngoặc toàn góc, ví dụ: 会議（かいぎ）で報告（ほうこく）する。 Chữ kana giữ nguyên, không thêm ngoặc.
- Tách đoạn bằng ký tự xuống dòng \\n.
- "translation_vi": bản dịch tiếng Việt tự nhiên của cả bài, giữ cách chia đoạn.
- "used_words": các từ trong danh sách đã thực sự xuất hiện trong bài, kèm nghĩa tiếng Việt ngắn gọn theo ngữ cảnh bài.
- "questions": câu hỏi đọc hiểu kiểu đề JLPT N1 bằng tiếng Nhật (không furigana; hỏi ý chính, ý đồ tác giả, nghĩa của cụm từ/chỉ thị từ, chi tiết), mỗi câu 4 lựa chọn, chỉ 1 đáp án đúng ("answer" là chỉ số 0–3), kèm giải thích bằng tiếng Việt.`;

// JSON schema cho structured output: Gemini trả về JSON đúng định dạng này
const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "passage_furigana", "translation_vi", "used_words", "questions"],
  properties: {
    title: { type: "string" },
    passage_furigana: { type: "string" },
    translation_vi: { type: "string" },
    used_words: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["word", "meaning_vi"],
        properties: { word: { type: "string" }, meaning_vi: { type: "string" } },
      },
    },
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "options", "answer", "explanation_vi"],
        properties: {
          question: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          answer: { type: "integer" },
          explanation_vi: { type: "string" },
        },
      },
    },
  },
} as const;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

// Model dự phòng khi model chính bị quá tải (503) dù đã thử lại
const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
const OVERLOADED = [500, 503, 504];

async function generateWithFallback(ai: GoogleGenAI, model: string, words: VocabInput[], type: ReadingType) {
  const models = [model, ...FALLBACK_MODELS.filter((m) => m !== model)];
  for (let i = 0; i < models.length; i++) {
    try {
      return await generateReading(ai, models[i], words, type);
    } catch (err) {
      const last = i === models.length - 1;
      if (last || !(err instanceof ApiError) || !OVERLOADED.includes(err.status)) throw err;
      console.warn(`[reading-api] ${models[i]} quá tải (${err.status}), chuyển sang ${models[i + 1]}`);
    }
  }
}

async function generateReading(ai: GoogleGenAI, model: string, words: VocabInput[], type: ReadingType) {
  const list = words.map((w) => `- ${w.word}（${w.reading}）`).join("\n");
  const spec = TYPE_SPECS[type];
  const prompt =
    `Dạng bài: ${spec.label} — dài ${spec.chars} ký tự tiếng Nhật, chia ${spec.paragraphs} đoạn, ${spec.questions} câu hỏi.\n` +
    `Danh sách ${words.length} từ vựng cần dùng:\n${list}`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseJsonSchema: OUTPUT_SCHEMA,
    },
  });

  const finish = response.candidates?.[0]?.finishReason;
  if (finish === FinishReason.MAX_TOKENS) {
    throw new Error("Bài đọc bị cắt ngang do quá dài. Hãy thử lại.");
  }
  if (!response.text) {
    throw new Error(`Gemini không trả về nội dung (finishReason: ${finish ?? "không rõ"}). Hãy thử lại với bộ từ khác.`);
  }
  return JSON.parse(response.text);
}

export default function readingApi(apiKey?: string, model = "gemini-2.5-flash"): Plugin {
  // Tự thử lại khi Gemini quá tải: tối đa 3 lần, chờ 2s → 4s (kèm jitter)
  const ai = apiKey
    ? new GoogleGenAI({
        apiKey,
        httpOptions: { retryOptions: { attempts: 3, initialDelay: 2, maxDelay: 10, httpStatusCodes: OVERLOADED } },
      })
    : null;

  const handler = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (req.url !== "/api/reading") return next();
    if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
    if (!ai) {
      return sendJson(res, 500, { error: "Chưa cấu hình API key: thêm GEMINI_API_KEY=... vào file web/.env.local rồi khởi động lại npm run dev." });
    }

    try {
      const { words, type = "chuubun" } = JSON.parse(await readBody(req)) as { words?: VocabInput[]; type?: ReadingType };
      if (!Array.isArray(words) || words.length === 0 || words.length > 120) {
        return sendJson(res, 400, { error: "Cần gửi từ 1 đến 120 từ vựng." });
      }
      if (!(type in TYPE_SPECS)) return sendJson(res, 400, { error: "Dạng bài không hợp lệ." });
      sendJson(res, 200, await generateWithFallback(ai, model, words, type));
    } catch (err) {
      if (err instanceof ApiError && OVERLOADED.includes(err.status)) {
        sendJson(res, 503, { error: "Máy chủ Gemini đang quá tải (đã tự thử lại và đổi model dự phòng nhưng vẫn lỗi). Hãy thử lại sau ít phút." });
      } else if (err instanceof ApiError) {
        const hint =
          err.status === 400 || err.status === 403 ? " Kiểm tra lại GEMINI_API_KEY." :
          err.status === 429 ? " Đã vượt hạn mức, hãy thử lại sau." : "";
        sendJson(res, 502, { error: `Lỗi Gemini API (${err.status}).${hint} ${err.message}` });
      } else {
        sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
      }
    }
  };

  return {
    name: "reading-api",
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}
