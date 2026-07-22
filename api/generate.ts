/**
 * Sinh nhân vật bằng Gemini (@google/genai): mô tả (1 câu) -> JSON spec (tên, màu, bộ chiêu).
 * Cần env GEMINI_API_KEY (hoặc GOOGLE_API_KEY). Không có key -> 503 để client dùng bản thử offline.
 * Chỉ trả DATA (không code) — client đọc spec để vẽ + build chiêu bằng cơ chế sẵn có.
 */
import { GoogleGenAI } from "@google/genai";

const MODEL = "gemini-3.5-flash-lite";

const SYSTEM = `Bạn thiết kế nhân vật cho game đối kháng 2D phong cách One Piece.
Từ mô tả của người dùng, trả về DUY NHẤT một object JSON đúng schema (không markdown, không giải thích):
{
  "name": "TÊN IN HOA, tối đa 18 ký tự",
  "emoji": "một emoji hợp chủ đề",
  "title": "danh hiệu ngắn, tối đa 22 ký tự",
  "desc": "mô tả cực ngắn, tối đa 38 ký tự",
  "aura": "#RRGGBB (màu hào quang chủ đạo)",
  "colors": { "skin":"#RRGGBB", "hair":"#RRGGBB", "top":"#RRGGBB (áo)", "bottom":"#RRGGBB (quần)", "accent":"#RRGGBB (điểm nhấn)" },
  "moves": {
    "close":   { "name":"tên đòn cận chiến", "power":1-3, "color":"#RRGGBB" },
    "ranged":  { "name":"tên chiêu xa", "power":1-3, "color":"#RRGGBB", "shot":"orb|beam|spread" },
    "special": { "name":"tên tuyệt chiêu", "power":1-3, "color":"#RRGGBB", "shot":"orb|beam|spread", "cry":"câu hô khi tung chiêu" }
  }
}
Quy tắc: mọi màu là hex #RRGGBB hợp lệ. power là số nguyên 1..3 (cân bằng: đừng để tất cả đều 3). Tên chiêu sáng tạo, hợp chủ đề.`;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request: Request): Promise<Response> {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) return jsonResponse({ error: "no_key" }, 503);

  let desc = "";
  try {
    const body = (await request.json()) as { desc?: unknown };
    desc = typeof body.desc === "string" ? body.desc.slice(0, 200) : "";
  } catch {
    return jsonResponse({ error: "bad_request" }, 400);
  }
  if (desc.trim().length < 3) return jsonResponse({ error: "too_short" }, 400);

  const ai = new GoogleGenAI({ apiKey: key });
  let text = "";
  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: `Mô tả nhân vật: ${desc}`,
      config: {
        systemInstruction: SYSTEM,
        responseMimeType: "application/json",
        temperature: 1,
        maxOutputTokens: 2048, // rộng rãi phòng model preview có "thinking" ăn bớt token
      },
    });
    text = (response.text || "").trim();
  } catch {
    return jsonResponse({ error: "upstream_error" }, 502);
  }

  // responseMimeType JSON thường trả sạch, nhưng vẫn bóc {..} cho chắc.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return jsonResponse({ error: "no_json" }, 502);
  let character: unknown;
  try {
    character = JSON.parse(text.slice(start, end + 1));
  } catch {
    return jsonResponse({ error: "invalid_json" }, 502);
  }

  // Trả thẳng — client còn normalize/validate lần nữa (chống mọi field lệch).
  return jsonResponse({ character });
}
