const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  });
}

export async function readImageFromForm(request) {
  const form = await request.formData();
  const image = form.get("image");
  const target = String(form.get("target") || "").trim().toLowerCase();

  if (!(image instanceof Blob)) {
    throw publicError("Please upload a drawing image.", 400);
  }

  const mimeType = image.type || "image/png";
  const bytes = new Uint8Array(await image.arrayBuffer());
  const base64Image = toBase64(bytes);

  return { base64Image, mimeType, target };
}

export async function callGemini(prompt, base64Image, mimeType) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw publicError("Missing GEMINI_API_KEY in environment.", 500);
  }

  const url = new URL(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`
  );
  url.searchParams.set("key", apiKey);

  const body = {
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.35
    },
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType,
              data: base64Image
            }
          }
        ]
      }
    ]
  };

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const details = await response.text();
    throw publicError(`AI service request failed: ${details}`, 502);
  }

  const payload = await response.json();
  const text = extractGeminiText(payload);
  if (!text) {
    throw publicError("AI service returned an empty result.", 502);
  }

  const parsed = parseModelJson(text);
  if (!parsed) {
    throw publicError("AI response format was invalid.", 502);
  }

  return parsed;
}

export function clampScore(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.max(0, Math.min(100, Math.round(number)));
}

export function sanitizeFeedback(value, fallback) {
  const text = String(value || "").trim();
  return text || fallback;
}

export function sanitizeGuess(value) {
  const text = String(value || "something fun").trim().toLowerCase();
  return text || "something fun";
}

export function publicError(message, status = 500) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function extractGeminiText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    return "";
  }

  return parts
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("\n")
    .trim();
}

function parseModelJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return null;
    }

    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function toBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}
