import { callGemini, clampScore, json, publicError, readImageFromForm, sanitizeFeedback } from "./_shared.js";

export const config = {
  runtime: "edge"
};

export default async function handler(request) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    const { base64Image, mimeType, target } = await readImageFromForm(request);

    if (!target) {
      throw publicError("target is required for evaluation.", 400);
    }

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

    const ai = await callGemini(prompt, base64Image, mimeType);
    const score = clampScore(ai.score, 60);

    return json({
      match: typeof ai.match === "boolean" ? ai.match : score >= 60,
      score,
      feedback: sanitizeFeedback(ai.feedback, "Interesting drawing! I can see what you were trying to create.")
    });
  } catch (error) {
    const status = error?.status || 500;
    const message = error?.message || "Failed to evaluate drawing.";
    return json({ error: message }, status);
  }
}
