"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { useMounted } from "@/hooks/useMounted";

export type LightboxImage = {
  /** Full-size source. */
  src: string;
  alt?: string;
};

type LightboxProps = {
  images: LightboxImage[];
  /** Index to open at; null closes the lightbox. */
  index: number | null;
  onClose: () => void;
  onIndexChange: (index: number) => void;
};

/**
 * Full-screen image viewer with keyboard nav and click-to-zoom.
 *
 * Zoom is a simple 1x/2x toggle with drag-to-pan rather than pinch handling —
 * it covers "let me actually look at this" without pulling in a gesture
 * library, and double-tap maps to the same toggle on touch.
 */
export default function Lightbox({ images, index, onClose, onIndexChange }: LightboxProps) {
  const mounted = useMounted();
  const [zoomed, setZoomed] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState<{ x: number; y: number } | null>(null);

  const isOpen = index !== null && index >= 0 && index < images.length;



  // Reset zoom whenever the visible image changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets zoom and pan when the visible image changes
    setZoomed(false);
    setOffset({ x: 0, y: 0 });
  }, [index]);

  const go = useCallback(
    (delta: number) => {
      if (index === null) return;
      const next = (index + delta + images.length) % images.length;
      onIndexChange(next);
    },
    [index, images.length, onIndexChange],
  );

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose, go]);

  if (!mounted || !isOpen) return null;

  const current = images[index];

  const content = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
    >
      {/* Controls */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setZoomed((z) => !z);
            setOffset({ x: 0, y: 0 });
          }}
          className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
          aria-label={zoomed ? "Zoom out" : "Zoom in"}
        >
          {zoomed ? <ZoomOut className="size-5" /> : <ZoomIn className="size-5" />}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
          aria-label="Close"
        >
          <X className="size-5" />
        </button>
      </div>

      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            className="absolute left-2 z-10 flex size-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20 sm:left-4"
            aria-label="Previous image"
          >
            <ChevronLeft className="size-6" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            className="absolute right-2 z-10 flex size-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20 sm:right-4"
            aria-label="Next image"
          >
            <ChevronRight className="size-6" />
          </button>
        </>
      )}

      {/* Image */}
      <img
        src={current.src}
        alt={current.alt ?? ""}
        draggable={false}
        onClick={(e) => {
          e.stopPropagation();
          setZoomed((z) => !z);
          setOffset({ x: 0, y: 0 });
        }}
        onMouseDown={(e) => {
          if (!zoomed) return;
          e.preventDefault();
          setDragging({ x: e.clientX - offset.x, y: e.clientY - offset.y });
        }}
        onMouseMove={(e) => {
          if (!dragging) return;
          setOffset({ x: e.clientX - dragging.x, y: e.clientY - dragging.y });
        }}
        onMouseUp={() => setDragging(null)}
        onMouseLeave={() => setDragging(null)}
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoomed ? 2 : 1})`,
          cursor: zoomed ? (dragging ? "grabbing" : "grab") : "zoom-in",
        }}
        className="max-h-[88vh] max-w-[92vw] select-none rounded-lg object-contain transition-transform duration-200"
      />

      {images.length > 1 && (
        <p className="absolute bottom-4 text-xs text-white/60">
          {index + 1} / {images.length}
        </p>
      )}
    </div>
  );

  return createPortal(content, document.body);
}
