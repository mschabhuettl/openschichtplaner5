/**
 * PhotoCropDialog — A modal for cropping employee photos.
 *
 * Uses a pure-CSS/canvas approach (no external crop library needed).
 * The user drags a square selection area on the image to define the crop.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PhotoCropDialogProps {
  /** The image file selected by the user */
  file: File;
  /** Called when the user confirms the crop */
  onConfirm: (file: File, crop: CropArea) => void;
  /** Called when the user cancels */
  onCancel: () => void;
}

export default function PhotoCropDialog({ file, onConfirm, onCancel }: PhotoCropDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<CropArea>({ x: 0, y: 0, width: 0, height: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [displayScale, setDisplayScale] = useState(1);

  // Load image from file
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImageEl(img);
      // Default crop: centered square covering 80% of the shorter side
      const side = Math.min(img.width, img.height) * 0.8;
      setCrop({
        x: (img.width - side) / 2,
        y: (img.height - side) / 2,
        width: side,
        height: side,
      });
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Draw image + crop overlay
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !imageEl) return;

    // Scale image to fit container (max 480px wide)
    const maxW = 480;
    const maxH = 400;
    const scale = Math.min(maxW / imageEl.width, maxH / imageEl.height, 1);
    setDisplayScale(scale);

    canvas.width = imageEl.width * scale;
    canvas.height = imageEl.height * scale;

    // Draw image
    ctx.drawImage(imageEl, 0, 0, canvas.width, canvas.height);

    // Draw dark overlay outside crop
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Clear crop area (show image underneath)
    const cx = crop.x * scale;
    const cy = crop.y * scale;
    const cw = crop.width * scale;
    const ch = crop.height * scale;
    ctx.clearRect(cx, cy, cw, ch);
    ctx.drawImage(
      imageEl,
      crop.x, crop.y, crop.width, crop.height,
      cx, cy, cw, ch,
    );

    // Draw crop border
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx, cy, cw, ch);

    // Draw corner handles
    const handleSize = 8;
    ctx.fillStyle = '#fff';
    for (const [hx, hy] of [
      [cx, cy], [cx + cw, cy],
      [cx, cy + ch], [cx + cw, cy + ch],
    ]) {
      ctx.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
    }
  }, [imageEl, crop]);

  useEffect(() => { draw(); }, [draw]);

  // Mouse handlers for dragging the crop area
  const getCanvasPos = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / displayScale,
      y: (e.clientY - rect.top) / displayScale,
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getCanvasPos(e);
    // Check if click is inside the crop area → drag mode
    if (
      pos.x >= crop.x && pos.x <= crop.x + crop.width &&
      pos.y >= crop.y && pos.y <= crop.y + crop.height
    ) {
      setDragging(true);
      setDragStart({ x: pos.x - crop.x, y: pos.y - crop.y });
    } else if (imageEl) {
      // Start new crop from click position
      setDragging(true);
      setDragStart(null);
      setCrop({ x: pos.x, y: pos.y, width: 0, height: 0 });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !imageEl) return;
    const pos = getCanvasPos(e);

    if (dragStart) {
      // Move existing crop
      let nx = pos.x - dragStart.x;
      let ny = pos.y - dragStart.y;
      nx = Math.max(0, Math.min(nx, imageEl.width - crop.width));
      ny = Math.max(0, Math.min(ny, imageEl.height - crop.height));
      setCrop(c => ({ ...c, x: nx, y: ny }));
    } else {
      // Resize from initial click — enforce square
      setCrop(prev => {
        const dx = pos.x - prev.x;
        const dy = pos.y - prev.y;
        const side = Math.max(20, Math.min(Math.abs(dx), Math.abs(dy)));
        const newX = dx < 0 ? prev.x - side : prev.x;
        const newY = dy < 0 ? prev.y - side : prev.y;
        return {
          x: Math.max(0, newX),
          y: Math.max(0, newY),
          width: Math.min(side, imageEl.width - Math.max(0, newX)),
          height: Math.min(side, imageEl.height - Math.max(0, newY)),
        };
      });
    }
  };

  const handleMouseUp = () => {
    setDragging(false);
    setDragStart(null);
    // Enforce square on release
    if (imageEl) {
      setCrop(c => {
        const side = Math.min(c.width, c.height);
        return { ...c, width: side, height: side };
      });
    }
  };

  const handleConfirm = () => {
    onConfirm(file, {
      x: Math.round(crop.x),
      y: Math.round(crop.y),
      width: Math.round(crop.width),
      height: Math.round(crop.height),
    });
  };

  // Preview dimensions
  const previewSize = 80;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onCancel}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full mx-4 p-4"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
          Foto zuschneiden
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Quadrat ziehen oder verschieben, dann bestätigen.
        </p>

        <div ref={containerRef} className="flex gap-4 items-start">
          {/* Canvas */}
          <div className="flex-1 flex justify-center">
            <canvas
              ref={canvasRef}
              className="cursor-crosshair rounded border border-gray-300 dark:border-gray-600 max-w-full"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
          </div>

          {/* Preview */}
          {imageEl && crop.width > 10 && (
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs text-gray-500">Vorschau</span>
              <canvas
                width={previewSize}
                height={previewSize}
                className="rounded-full border-2 border-gray-300 dark:border-gray-600"
                ref={el => {
                  if (!el || !imageEl) return;
                  const ctx = el.getContext('2d');
                  if (!ctx) return;
                  ctx.clearRect(0, 0, previewSize, previewSize);
                  // Draw circular clip
                  ctx.beginPath();
                  ctx.arc(previewSize / 2, previewSize / 2, previewSize / 2, 0, Math.PI * 2);
                  ctx.clip();
                  ctx.drawImage(
                    imageEl,
                    crop.x, crop.y, crop.width, crop.height,
                    0, 0, previewSize, previewSize,
                  );
                }}
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={crop.width < 10}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Zuschneiden & Hochladen
          </button>
        </div>
      </div>
    </div>
  );
}
