// A small circular crop/zoom/pan tool. Opens a modal over the current page,
// lets the user drag the photo and adjust zoom so their face sits inside the
// circle guide, and resolves with a cropped PNG Blob when they confirm.
//
// Usage: const blob = await openCropper(file); // null if the user cancels

const OUTPUT_SIZE = 320; // px, the final square/circular photo saved
const PREVIEW_SIZE = 280; // px, the on-screen crop circle
// Starting zoom above 1x guarantees there's draggable slack in BOTH
// directions from the first frame, even for a photo whose shorter side
// already exactly fills the circle (at exactly 1x that axis can't be
// panned at all, which made repositioning impossible until you touched
// the slider first).
const INITIAL_ZOOM = 1.3;

export function openCropper(file) {
  return new Promise((resolve) => {
    const imageUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const overlay = document.createElement("div");
      overlay.className = "cropper-overlay";
      overlay.innerHTML = `
        <div class="cropper-modal">
          <h3>Adjust your photo</h3>
          <p class="muted">Drag the photo to reposition your face inside the circle. Use the slider to zoom in or out.</p>
          <div class="cropper-stage" style="width:${PREVIEW_SIZE}px;height:${PREVIEW_SIZE}px;">
            <canvas width="${PREVIEW_SIZE}" height="${PREVIEW_SIZE}"></canvas>
            <div class="cropper-circle-guide"></div>
          </div>
          <input type="range" class="cropper-zoom" min="1" max="4" step="0.01" value="${INITIAL_ZOOM}" />
          <div class="cropper-actions">
            <button type="button" class="btn secondary" data-action="cancel">Cancel</button>
            <button type="button" class="btn" data-action="confirm">Use Photo</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);

      const canvas = overlay.querySelector("canvas");
      const ctx = canvas.getContext("2d");
      const zoomSlider = overlay.querySelector(".cropper-zoom");

      // Base scale so the image's shorter side exactly fills the preview,
      // then the zoom slider multiplies on top of that.
      const baseScale = PREVIEW_SIZE / Math.min(img.width, img.height);
      let zoom = INITIAL_ZOOM;
      let offsetX = 0; // pan, in preview px, relative to centered position
      let offsetY = 0;

      function draw() {
        const scale = baseScale * zoom;
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        const x = (PREVIEW_SIZE - drawW) / 2 + offsetX;
        const y = (PREVIEW_SIZE - drawH) / 2 + offsetY;

        ctx.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
        ctx.fillStyle = "#eef3f2";
        ctx.fillRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
        ctx.drawImage(img, x, y, drawW, drawH);
      }

      function clampOffsets() {
        const scale = baseScale * zoom;
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        const maxOffsetX = Math.max(0, (drawW - PREVIEW_SIZE) / 2);
        const maxOffsetY = Math.max(0, (drawH - PREVIEW_SIZE) / 2);
        offsetX = Math.min(maxOffsetX, Math.max(-maxOffsetX, offsetX));
        offsetY = Math.min(maxOffsetY, Math.max(-maxOffsetY, offsetY));
      }

      draw();

      let dragging = false;
      let lastX = 0;
      let lastY = 0;

      function pointerDown(e) {
        dragging = true;
        const p = e.touches ? e.touches[0] : e;
        lastX = p.clientX;
        lastY = p.clientY;
      }
      function pointerMove(e) {
        if (!dragging) return;
        const p = e.touches ? e.touches[0] : e;
        offsetX += p.clientX - lastX;
        offsetY += p.clientY - lastY;
        lastX = p.clientX;
        lastY = p.clientY;
        clampOffsets();
        draw();
        e.preventDefault();
      }
      function pointerUp() {
        dragging = false;
      }

      canvas.addEventListener("mousedown", pointerDown);
      window.addEventListener("mousemove", pointerMove);
      window.addEventListener("mouseup", pointerUp);
      canvas.addEventListener("touchstart", pointerDown, { passive: true });
      window.addEventListener("touchmove", pointerMove, { passive: false });
      window.addEventListener("touchend", pointerUp);

      zoomSlider.addEventListener("input", () => {
        zoom = parseFloat(zoomSlider.value);
        clampOffsets();
        draw();
      });

      function cleanup() {
        window.removeEventListener("mousemove", pointerMove);
        window.removeEventListener("mouseup", pointerUp);
        window.removeEventListener("touchmove", pointerMove);
        window.removeEventListener("touchend", pointerUp);
        URL.revokeObjectURL(imageUrl);
        overlay.remove();
      }

      overlay.querySelector('[data-action="cancel"]').addEventListener("click", () => {
        cleanup();
        resolve(null);
      });

      overlay.querySelector('[data-action="confirm"]').addEventListener("click", () => {
        const scale = (baseScale * zoom * OUTPUT_SIZE) / PREVIEW_SIZE;
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        const x = (OUTPUT_SIZE - drawW) / 2 + offsetX * (OUTPUT_SIZE / PREVIEW_SIZE);
        const y = (OUTPUT_SIZE - drawH) / 2 + offsetY * (OUTPUT_SIZE / PREVIEW_SIZE);

        const outCanvas = document.createElement("canvas");
        outCanvas.width = OUTPUT_SIZE;
        outCanvas.height = OUTPUT_SIZE;
        const outCtx = outCanvas.getContext("2d");

        outCtx.save();
        outCtx.beginPath();
        outCtx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
        outCtx.closePath();
        outCtx.clip();
        outCtx.drawImage(img, x, y, drawW, drawH);
        outCtx.restore();

        outCanvas.toBlob(
          (blob) => {
            cleanup();
            resolve(blob);
          },
          "image/png",
          0.92
        );
      });
    };

    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });
}
