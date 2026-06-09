# Quick Draw Playground (Gemini Vision)

Educational AI drawing demo for children.

This project now follows the updated CLAUDE.MD requirements:
- Frontend: HTML, CSS, Vanilla JavaScript, Canvas
- Backend: Node.js + Fastify
- AI: Gemini 2.5 Flash-Lite Vision
- No TensorFlow.js or Quick Draw classifier

## Features

- Free Draw Mode
  - Sends canvas PNG to Gemini via POST /api/guess
  - Shows guess, confidence, and encouraging feedback
- Draw What AI Says Mode
  - Random target prompt (sun, fish, cat, tree, house, etc.)
  - Sends drawing to POST /api/evaluate with target
  - Returns match, score 0-100, and feedback
- Scoring Game Mode
  - Uses Gemini as a friendly judge each round
  - Adds round score into total points

## API

- POST /api/guess
  - multipart/form-data with image
  - response: { guess, confidence, feedback }
- POST /api/evaluate
  - multipart/form-data with image and target
  - response: { match, score, feedback }

## Run

1. Install dependencies

npm install

2. Configure environment

Copy .env.example to .env and set GEMINI_API_KEY.

3. Start server

npm run dev

4. Open app

http://localhost:3000

## Environment Variables

- GEMINI_API_KEY: required
- GEMINI_MODEL: optional, default gemini-2.5-flash-lite
- PORT: optional, default 3000

## Notes

- The app is intentionally supportive for children aged 4-8.
- API errors are handled gracefully in the UI.
- UI logic and API calls are separated into app.js and api-client.js.

## Deploy On Vercel

1. Push this project to GitHub.
2. In Vercel, click New Project and import the repository.
3. Framework Preset: Other.
4. Build Command: leave empty.
5. Output Directory: leave empty.
6. Add environment variables in Vercel Project Settings:
   - GEMINI_API_KEY
   - GEMINI_MODEL (optional, default gemini-2.5-flash-lite)
7. Deploy.

After deploy:

- Static frontend is served from the root files.
- API routes are served by Vercel Functions:
  - /api/guess
  - /api/evaluate
