import type {Word} from "./types"
// import kiểu Word vào

export interface Example {
  tokens: Furi[];
  vi: string;
}
// Tạo bộ quy tắc dữ liệu Example quy định 2 phần tử là jp và vi có dạng dữ liệu là string

export interface Related {
    label: string;
    text: string;
    vi: string;
}

export interface Furi {
    text: string;
    ruby?: string;
}
// Tạo bộ quy tắc dữ liệu Related quy định 3 phần tử là label, text và vi có dạng dữ liệu là string


const lines = (s: string): string[] => s.split("\n").map((x) => x.trim()).filter(Boolean);
// Hàm lines nhận vào 1 chuỗi s, kết quả trả về mong muốn là 1 mảng str
// Nó tách chuỗi s được ngăn cách bằng các ký tự \n và loại bỏ các khoảng trắng 2 đầu của các phần tử con
// Mục đích là để làm sạch dữ liệu
export function getExamples(w: Word): Example[] {
  const jp = lines(w.examples_furigana);
  const vi = lines(w.examples_vi);
  return jp.map((j, i) => ({ tokens: parseFurigana(j), vi: vi[i] ?? "" }));
}
//hàm getExample nhận w có kiểu Word làm tham số và mong muốn trả về mảng Example.
// trong hàm khai báo biến jp, vi sử dụng hàm lines để trả về 2 mảng dữ liệu sạch
// Trả về 1 danh sách đối tượng jp, vi. 
export function getRelated(w: Word) : Related[] {
    return lines(w.related).map((line) => {
        const label = line.slice(0,1);
        const rest = line.slice(1).trim();
        const idx = rest.lastIndexOf(":");
        return idx === -1 ? {label, text: rest, vi: ""} : {label, text: rest.slice(0,idx), vi: rest. slice(idx + 2)};
    });
}
// hàm getRelated nhận w có kiểu Word làm tham số và mong muốn trả về 1 mảng Related
// trả về line tách từ phần related lấy ra từ dữ liệu
// khai báo hằng label sẽ là ký tự đầu liên của line
// hằng rest lấy phần còn lại và loại bỏ khoảng trắng 2 đầu
// hằng idx tìm vị trí index cuối cùng của ":" trong chuỗi rest
// phần sau là nếu idx là -1 thì trả về label, text và vi rỗng còn không thì trả về label, text cắt từ đầu đến vị trí idx của rest, và vi là cắt từ sau ":" cuối 3 ký tự

// Hàm furigana sẽ lấy các từ vựng có furi đi kèm với index của từ phía trước nó. Các từ furigana sẽ được bọc trong các dấu ().
//    "examples_furigana": "知人（ちじん）の葬式（そうしき）に参列（さんれつ）した。\n父（ちち）の葬式（そうしき）は仏（ぶっ）式（しき）で行（おこな）った。\n叔母（おば）の葬式（そうしき）に行（い）った。",

//[
//   ["青春", "時代"],  // Kết quả sau khi tách phần tử thứ nhất
//   ["懐", "しく"]     // Kết quả sau khi tách phần tử thứ hai

const RUBY_RE = /([\u4e00-\u9fff\u3005\u30f6０-９0-9]+)[（(]([^）)]*)[）)]/g;

export function parseFurigana(sentence: string): Furi[] {
  const tokens: Furi[] = [];
  let last = 0;

  for (const m of sentence.matchAll(RUBY_RE)) {
    const start = m.index!;
    if (start > last) {
      tokens.push({ text: sentence.slice(last, start) }); // chữ thường, không furigana
    }
    tokens.push({ text: m[1], ruby: m[2].trim() });       // kanji + furigana
    last = start + m[0].length;
  }
  if (last < sentence.length) {
    tokens.push({ text: sentence.slice(last) });
  }
  return tokens;
}