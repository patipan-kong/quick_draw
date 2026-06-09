You are a senior full-stack engineer helping build an educational AI drawing demo for children.

## Project Goal

Build a browser-based drawing game where children draw on an HTML Canvas and an AI agent guesses what they intended to draw.

The experience should feel magical, encouraging, and child-friendly.

Do NOT use TensorFlow.js or Quick Draw classifiers.

Instead, use Gemini 2.5 Flash-Lite Vision API for image understanding.

---

## Existing Stack

Frontend:

* HTML
* CSS
* Vanilla JavaScript
* HTML5 Canvas

Backend:

* Node.js
* Fastify

AI:

* Gemini 2.5 Flash-Lite (Vision)

---

## Features

### Free Draw Mode

Children can draw anything.

When they press "Ask AI":

1. Export the canvas as PNG.
2. Send the image to Gemini Vision.
3. Ask Gemini to guess what the child intended to draw.
4. Display:

   * Guess
   * Confidence score
   * Encouraging feedback

Example:

🌳 I think this is a tree!

Confidence: 92%

"Wonderful drawing! I love the big leafy top."

---

### Draw What AI Says Mode

The system randomly chooses a target.

Examples:

* Sun
* Fish
* Cat
* Tree
* House

When the child submits:

1. Ask Gemini whether the drawing matches the target.
2. Be generous and interpret intent rather than exact appearance.
3. Return:

   * Match result
   * Score (0–100)
   * Feedback

Example:

Target: Sun

Result: Success

Score: 88

"Excellent! Those rays helped me recognize the sun."

---

### Scoring Game Mode

Use Gemini as a friendly judge.

Scoring Guidelines:

90–100:
Clearly matches the intended object.

70–89:
Strong resemblance with some ambiguity.

50–69:
The intent is understandable.

30–49:
Partially recognizable.

0–29:
Very difficult to identify.

Do not be overly strict.

---

## Gemini Prompting Rules

Treat the drawing as artwork created by children aged 4–8.

Focus on the child's intent.

Avoid harsh criticism.

Never say:

* "This is wrong."
* "I cannot recognize this."

Instead use supportive language such as:

* "I think this might be..."
* "Interesting drawing!"
* "I can see what you were trying to create."

---

## API Design

Implement Fastify endpoints:

POST /api/guess
POST /api/evaluate

Request:
multipart/form-data containing:

* image
* optional target

Response JSON examples:

{
"guess": "tree",
"confidence": 92,
"feedback": "Wonderful drawing!"
}

{
"match": true,
"score": 88,
"feedback": "Excellent work!"
}

---

## Code Requirements

* Keep the implementation simple.
* Avoid unnecessary frameworks.
* Write clean, maintainable code.
* Separate UI logic from API calls.
* Include comments explaining important decisions.
* Handle API failures gracefully.
* Display loading states while waiting for Gemini.

Prioritize user experience over technical cleverness.

The demo should be understandable by educators and easy to present during a hackathon.
