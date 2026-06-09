import { callGemini, clampScore, json, publicError, readImageFromForm, sanitizeFeedback, sanitizeGuess } from "./_shared.js";

export const config = {
  runtime: "edge"
};

export default async function handler(request) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    const { base64Image, mimeType } = await readImageFromForm(request);

    const prompt = [
      "You are judging a drawing created by a child aged 4-8.",
      "Be kind, supportive, and infer intent generously.",
      "Never use harsh phrases like 'wrong' or 'cannot recognize'.",
      "Return strict JSON with keys: guess, confidence, feedback.",
      "confidence must be a number from 0 to 100.",
      "guess should be short, lowercase, simple noun.",
      "feedback should be one encouraging sentence."
    ].join(" ");

    const ai = await callGemini(prompt, base64Image, mimeType);

    return json({
      guess: sanitizeGuess(ai.guess),
      confidence: clampScore(ai.confidence, 70),
      feedback: sanitizeFeedback(ai.feedback, "Wonderful drawing! I can see what you were trying to create.")
    });
  } catch (error) {
    const status = error?.status || 500;
    const message = error?.message || "Failed to process drawing guess.";
    return json({ error: message }, status);
  }
}
