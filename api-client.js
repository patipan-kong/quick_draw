async function requestJson(url, formData) {
  const response = await fetch(url, {
    method: "POST",
    body: formData
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    const message = payload && payload.error ? payload.error : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

export async function guessDrawing(imageBlob) {
  const formData = new FormData();
  formData.append("image", imageBlob, "drawing.png");
  return requestJson("/api/guess", formData);
}

export async function evaluateDrawing(imageBlob, target) {
  const formData = new FormData();
  formData.append("image", imageBlob, "drawing.png");
  formData.append("target", target || "");
  return requestJson("/api/evaluate", formData);
}
