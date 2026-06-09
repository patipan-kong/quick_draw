import { evaluateDrawing, guessDrawing } from "./api-client.js";

const modeButtons = Array.from(document.querySelectorAll(".mode-btn"));
const targetText = document.getElementById("targetText");
const scoreWrap = document.getElementById("scoreWrap");
const scoreText = document.getElementById("scoreText");
const predictionList = document.getElementById("predictionList");
const encouragementText = document.getElementById("encouragementText");
const resultTitle = document.getElementById("resultTitle");
const resultText = document.getElementById("resultText");

const clearBtn = document.getElementById("clearBtn");
const undoBtn = document.getElementById("undoBtn");
const predictBtn = document.getElementById("predictBtn");
const newRoundBtn = document.getElementById("newRoundBtn");

const canvas = document.getElementById("drawCanvas");
const ctx = canvas.getContext("2d");

const TARGETS = ["sun", "fish", "cat", "tree", "house", "bird", "car", "apple"];

const ENCOURAGEMENT = [
  "Wonderful effort!",
  "I can see your imagination.",
  "Interesting drawing!",
  "Great artist energy!",
  "Keep drawing, this is awesome!"
];

const state = {
  mode: "free",
  strokes: [],
  currentStroke: null,
  isDrawing: false,
  score: 0,
  target: null,
  busy: false
};

function setupCanvas() {
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#111827";
  clearCanvas();

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointerleave", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
}

function onPointerDown(event) {
  const point = getCanvasPoint(event);
  state.isDrawing = true;
  state.currentStroke = [point];

  ctx.beginPath();
  ctx.moveTo(point.x, point.y);
}

function onPointerMove(event) {
  if (!state.isDrawing) {
    return;
  }

  const point = getCanvasPoint(event);
  state.currentStroke.push(point);
  ctx.lineTo(point.x, point.y);
  ctx.stroke();
}

function onPointerUp() {
  if (!state.isDrawing) {
    return;
  }

  state.isDrawing = false;
  if (state.currentStroke && state.currentStroke.length > 0) {
    state.strokes.push(state.currentStroke);
  }

  state.currentStroke = null;
}

function getCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY
  };
}

function redrawFromStrokes() {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const stroke of state.strokes) {
    if (!stroke.length) {
      continue;
    }

    ctx.beginPath();
    ctx.moveTo(stroke[0].x, stroke[0].y);

    for (let i = 1; i < stroke.length; i += 1) {
      ctx.lineTo(stroke[i].x, stroke[i].y);
    }

    ctx.stroke();
  }
}

function clearCanvas() {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  state.strokes = [];
  state.currentStroke = null;
  resultText.textContent = "";
  predictionList.innerHTML = "<li>Waiting for your drawing.</li>";
}

function undoStroke() {
  if (state.strokes.length === 0 || state.busy) {
    return;
  }

  state.strokes.pop();
  redrawFromStrokes();
}

function setMode(mode) {
  state.mode = mode;
  state.score = 0;
  scoreText.textContent = "0";

  updateModeButtons();

  if (mode === "free") {
    scoreWrap.hidden = true;
    resultTitle.textContent = "I think this is...";
    targetText.textContent = "Draw anything you like.";
  }

  if (mode === "challenge") {
    scoreWrap.hidden = true;
    resultTitle.textContent = "AI Round Result";
    pickNewTarget();
  }

  if (mode === "score") {
    scoreWrap.hidden = false;
    resultTitle.textContent = "AI Round Result";
    pickNewTarget();
  }

  clearCanvas();
}

function updateModeButtons() {
  for (const button of modeButtons) {
    const isActive = button.dataset.mode === state.mode;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-checked", isActive ? "true" : "false");
  }
}

function pickNewTarget() {
  state.target = TARGETS[Math.floor(Math.random() * TARGETS.length)];
  targetText.textContent = `Target: ${capitalize(state.target)}`;
  encouragementText.textContent = ENCOURAGEMENT[Math.floor(Math.random() * ENCOURAGEMENT.length)];
}

function setBusy(busy, message = "") {
  state.busy = busy;
  predictBtn.disabled = busy;
  clearBtn.disabled = busy;
  undoBtn.disabled = busy;
  modeButtons.forEach((button) => {
    button.disabled = busy;
  });

  predictBtn.textContent = busy ? "Thinking..." : "Ask AI";
  if (busy) {
    resultText.textContent = message || "Asking Gemini...";
  }
}

async function canvasToPngBlob() {
  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });

  if (!blob) {
    throw new Error("Failed to export drawing image.");
  }

  return blob;
}

async function predictDrawing() {
  if (state.busy) {
    return;
  }

  if (state.strokes.length === 0) {
    resultText.textContent = "Please draw something first.";
    return;
  }

  setBusy(true, "Gemini is looking at your drawing...");

  try {
    const image = await canvasToPngBlob();

    // Free mode asks AI to guess intent, while other modes ask AI to evaluate against target.
    if (state.mode === "free") {
      const response = await guessDrawing(image);
      renderFreeResult(response);
      return;
    }

    const response = await evaluateDrawing(image, state.target);
    renderEvaluateResult(response);

    if (state.mode === "score") {
      state.score += Number(response.score || 0);
      scoreText.textContent = String(state.score);
    }
  } catch (error) {
    console.error(error);
    resultText.textContent = "AI service is unavailable now. Please try again in a moment.";
    encouragementText.textContent = "You still did a great drawing.";
  } finally {
    setBusy(false);
  }
}

function renderFreeResult(response) {
  const guess = capitalize(response.guess || "something fun");
  const confidence = clampPercent(response.confidence);

  predictionList.innerHTML = `<li>${guess} (${confidence}%)</li>`;
  resultText.textContent = response.feedback || "Interesting drawing! I can see your idea.";
  encouragementText.textContent = `I think this might be ${guess}.`;
}

function renderEvaluateResult(response) {
  const isMatch = Boolean(response.match);
  const score = clampPercent(response.score);
  const verdict = isMatch ? "Success" : "Keep Trying";

  predictionList.innerHTML = [
    `<li>Target: ${capitalize(state.target)}</li>`,
    `<li>Result: ${verdict}</li>`,
    `<li>Score: ${score}</li>`
  ].join("");

  resultText.textContent = response.feedback || "I can see what you were trying to create.";
  encouragementText.textContent = isMatch
    ? "Excellent work!"
    : "Nice effort. Try one more round.";
}

function clampPercent(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(number)));
}

function capitalize(value) {
  if (!value) {
    return "Unknown";
  }

  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

function bindEvents() {
  modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (state.busy) {
        return;
      }

      setMode(button.dataset.mode);
    });
  });

  clearBtn.addEventListener("click", () => {
    if (state.busy) {
      return;
    }

    clearCanvas();
  });

  undoBtn.addEventListener("click", undoStroke);
  predictBtn.addEventListener("click", predictDrawing);

  newRoundBtn.addEventListener("click", () => {
    if (state.busy) {
      return;
    }

    if (state.mode !== "free") {
      pickNewTarget();
    }

    clearCanvas();
  });
}

function init() {
  setupCanvas();
  bindEvents();
  setMode("free");
  encouragementText.textContent = "AI is ready. Draw anything and press Ask AI.";
}

init();
