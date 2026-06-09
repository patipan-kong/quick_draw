import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import Fastify from "fastify";
import fastifyMultipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";

dotenv.config();

const app = Fastify({ logger: true });
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

await app.register(fastifyMultipart, {
  limits: {
    files: 1,
    fileSize: 6 * 1024 * 1024
  }
});

await app.register(fastifyStatic, {
  root: __dirname,
  prefix: "/"
});

app.get("/api/health", async () => {
  return { ok: true, model: GEMINI_MODEL };
});

app.post("/api/guess", async (request, reply) => {
  try {
    const { imageBuffer, mimeType } = await readDrawingUpload(request);

    // Prompt is strict about JSON shape so frontend can render deterministic fields.
    const prompt = [
      "You are judging a drawing created by a child aged 4-8.",
      "Be kind, supportive, and infer intent generously.",
      "Never use harsh phrases like 'wrong' or 'cannot recognize'.",
      "Return strict JSON with keys: guess, confidence, feedback.",
      "confidence must be a number from 0 to 100.",
      "guess should be short, lowercase, simple noun.",
      "feedback should be one encouraging sentence."
    ].join(" ");

    const ai = await callGeminiVision(prompt, imageBuffer, mimeType);

    return {
      guess: sanitizeGuess(ai.guess),
      confidence: clampScore(ai.confidence, 70),
      feedback: sanitizeFeedback(ai.feedback, "Wonderful drawing! I can see what you were trying to create.")
    };
  } catch (error) {
    request.log.error(error);
    return reply.code(error.statusCode || 500).send({
      error: error.publicMessage || "Failed to process drawing guess."
    });
  }
});

app.post("/api/evaluate", async (request, reply) => {
  try {
    const { imageBuffer, mimeType, target } = await readDrawingUpload(request);

    if (!target) {
      return reply.code(400).send({ error: "target is required for evaluation." });
    }

    // Score rubric is embedded in prompt so Gemini grading follows consistent ranges.
    const prompt = [
      "You are a friendly drawing judge for children aged 4-8.",
      `Target object: ${target}.`,
      "Be generous and focus on intent over exact appearance.",
      "Scoring rubric:",
      "90-100 clearly matches target,",
      "70-89 strong resemblance,",
      "50-69 understandable intent,",
      "30-49 partially recognizable,",
      "0-29 very hard to identify.",
      "Do not be overly strict.",
      "Return strict JSON with keys: match, score, feedback.",
      "match must be boolean, score 0-100 number, feedback one supportive sentence."
    ].join(" ");

    const ai = await callGeminiVision(prompt, imageBuffer, mimeType);
    const score = clampScore(ai.score, 60);

    return {
      match: typeof ai.match === "boolean" ? ai.match : score >= 60,
      score,
      feedback: sanitizeFeedback(ai.feedback, "Interesting drawing! I can see what you were trying to create.")
    };
  } catch (error) {
    request.log.error(error);
    return reply.code(error.statusCode || 500).send({
      error: error.publicMessage || "Failed to evaluate drawing."
    });
  }
});

app.setNotFoundHandler((request, reply) => {
  if (request.url.startsWith("/api/")) {
    return reply.code(404).send({ error: "API route not found." });
  }

  return reply.sendFile("index.html");
});

async function readDrawingUpload(request) {
  const parts = request.parts();
  let imageBuffer = null;
  let mimeType = "image/png";
  let target = "";

  for await (const part of parts) {
    if (part.type === "file" && part.fieldname === "image") {
      imageBuffer = await streamToBuffer(part.file);
      mimeType = part.mimetype || mimeType;
    }

    if (part.type === "field" && part.fieldname === "target") {
      target = String(part.value || "").trim().toLowerCase();
    }
  }

  if (!imageBuffer || imageBuffer.length === 0) {
    const error = new Error("image is required.");
    error.statusCode = 400;
    error.publicMessage = "Please upload a drawing image.";
    throw error;
  }

  return { imageBuffer, mimeType, target };
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

async function callGeminiVision(prompt, imageBuffer, mimeType) {
  if (!GEMINI_API_KEY) {
    const error = new Error("Missing GEMINI_API_KEY.");
    error.statusCode = 500;
    error.publicMessage = "Server is not configured with GEMINI_API_KEY.";
    throw error;
  }

  const url = new URL(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`
  );
  url.searchParams.set("key", GEMINI_API_KEY);

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
              data: imageBuffer.toString("base64")
            }
          }
        ]
      }
    ]
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const details = await response.text();
    const error = new Error(`Gemini request failed: ${response.status} ${details}`);
    error.statusCode = 502;
    error.publicMessage = "AI service request failed.";
    throw error;
  }

  const payload = await response.json();
  const text = extractGeminiText(payload);

  if (!text) {
    const error = new Error("Gemini returned empty content.");
    error.statusCode = 502;
    error.publicMessage = "AI service returned an empty result.";
    throw error;
  }

  const parsed = parseModelJson(text);
  if (!parsed) {
    const error = new Error(`Could not parse Gemini JSON: ${text}`);
    error.statusCode = 502;
    error.publicMessage = "AI response format was invalid.";
    throw error;
  }

  return parsed;
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
    // Fallback handles cases where model wraps JSON in extra text.
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

function sanitizeGuess(value) {
  const text = String(value || "something fun").trim().toLowerCase();
  return text || "something fun";
}

function sanitizeFeedback(value, fallback) {
  const text = String(value || "").trim();
  if (!text) {
    return fallback;
  }

  return text;
}

function clampScore(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.max(0, Math.min(100, Math.round(number)));
}

const port = Number(process.env.PORT || 3000);
await app.listen({ port, host: "0.0.0.0" });
