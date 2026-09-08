// A small crop/zoom/pan tool. Opens a modal over the current page, lets the
// user drag the image and adjust zoom to frame it inside the guide, and
// resolves with a cropped PNG Blob when they confirm. Used both for the
// circular profile photo and (with a rectangular shape) for a custom
// signature's banner, so the guide/output shape is configurable.
//
// Usage:
//   const blob = await openCropper(file); // circular, 320x320 (default)
//   const blob = await openCropper(file, {
//     shape: "rect", aspectRatio: 912 / 212, outputWidth: 940,
//   }); // rectangular, aspect-ratio locked
// Resolves null if the user cancels.

const PREVIEW_WIDTH = 320;
// Starting zoom above 1x guarantees there's draggable slack in BOTH
// directions from the first frame, even for an image whose shorter side
// already exactly fills the frame (at exactly 1x that axis can't be
// panned at all, which made repositioning impossible until you touched
// the slider first).
const INITIAL_ZOOM = 1.3;

export function openCropper(file, options = {}) {
  const shape = options.shape || "circle";
  const isRect = shape === "rect";
  const aspectRatio = isRect ? options.aspectRatio || 1 : 1;
  const previewWidth = PREVIEW_WIDTH;
  const previewHeight = isRect ? Math.round(PREVIEW_WIDTH / aspectRatio) : PREVIEW_WIDTH;
  const outputWidth = options.outputWidth || (isRect ? 940 : 320);
  const outputHeight = isRect ? Math.round(outputWidth / aspectRatio) : outputWidth;

  return new Promise((resolve) => {
    const imageUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const overlay = document.createElement("div");
      overlay.className = "cropper-overlay";
      overlay.innerHTML = `
        <div class="cropper-modal">
          <h3>${isRect ? "Adjust your banner" : "Adjust your photo"}</h3>
          <p class="muted">${
            isRect
              ? "Drag to reposition, use the slider to zoom, to fit your banner in the frame."
              : "Drag the photo to reposition your face inside the circle. Use the slider to zoom in or out."
          }</p>
          <div class="cropper-stage" style="width:${previewWidth}px;height:${previewHeight}px;">
            <canvas width="${previewWidth}" height="${previewHeight}"></canvas>
            ${isRect ? "" : '<div class="cropper-circle-guide"></div>'}
          </div>
          <input type="range" class="cropper-zoom" min="1" max="4" step="0.01" value="${INITIAL_ZOOM}" />
          <div class="cropper-actions">
            <button type="button" class="btn secondary" data-action="cancel">Cancel</button>
            <button type="button" class="btn" data-action="confirm">${isRect ? "Use Banner" : "Use Photo"}</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);

      const canvas = overlay.querySelector("canvas");
      const ctx = canvas.getContext("2d");
      const zoomSlider = overlay.querySelector(".cropper-zoom");

      // Base scale so the image fully covers the preview frame (like CSS
      // object-fit: cover), then the zoom slider multiplies on top of that.
      const baseScale = Math.max(previewWidth / img.width, previewHeight / img.height);
      let zoom = INITIAL_ZOOM;
      let offsetX = 0; // pan, in preview px, relative to centered position
      let offsetY = 0;

      function draw() {
        const scale = baseScale * zoom;
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        const x = (previewWidth - drawW) / 2 + offsetX;
        const y = (previewHeight - drawH) / 2 + offsetY;

        ctx.clearRect(0, 0, previewWidth, previewHeight);
        ctx.fillStyle = "#eef3f2";
        ctx.fillRect(0, 0, previewWidth, previewHeight);
        ctx.drawImage(img, x, y, drawW, drawH);
      }

      function clampOffsets() {
        const scale = baseScale * zoom;
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        const maxOffsetX = Math.max(0, (drawW - previewWidth) / 2);
        const maxOffsetY = Math.max(0, (drawH - previewHeight) / 2);
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
        const ratio = outputWidth / previewWidth;
        const scale = baseScale * zoom * ratio;
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        const x = (outputWidth - drawW) / 2 + offsetX * ratio;
        const y = (outputHeight - drawH) / 2 + offsetY * ratio;

        const outCanvas = document.createElement("canvas");
        outCanvas.width = outputWidth;
        outCanvas.height = outputHeight;
        const outCtx = outCanvas.getContext("2d");

        outCtx.save();
        outCtx.beginPath();
        if (isRect) {
          outCtx.rect(0, 0, outputWidth, outputHeight);
        } else {
          outCtx.arc(outputWidth / 2, outputHeight / 2, outputWidth / 2, 0, Math.PI * 2);
        }
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
