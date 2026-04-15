"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

const DRIFT_SPEED = 0.4;

export default function LaurAIPage() {
  const router = useRouter();
  const [textVisible, setTextVisible] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragging = useRef(false);
  const lastX = useRef(0);
  const offsetPx = useRef(0);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    const fadeIn = setTimeout(() => setTextVisible(true), 800);
    const fadeOut = setTimeout(() => setTextVisible(false), 5000);
    return () => {
      clearTimeout(fadeIn);
      clearTimeout(fadeOut);
    };
  }, []);

  useEffect(() => {
    function tick() {
      if (!dragging.current) {
        const img = imgRef.current;
        if (img && img.offsetWidth > 0) {
          offsetPx.current -= DRIFT_SPEED;
          if (offsetPx.current <= -img.offsetWidth) {
            offsetPx.current += img.offsetWidth;
          }
          applyOffset();
        }
      }
      animRef.current = requestAnimationFrame(tick);
    }
    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  function applyOffset() {
    if (wrapperRef.current) {
      wrapperRef.current.style.transform = `translateX(${offsetPx.current}px)`;
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    dragging.current = true;
    lastX.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    const dx = e.clientX - lastX.current;
    lastX.current = e.clientX;
    const img = imgRef.current;
    if (!img || img.offsetWidth === 0) return;
    offsetPx.current -= dx;
    offsetPx.current = ((offsetPx.current % img.offsetWidth) + img.offsetWidth) % img.offsetWidth;
    offsetPx.current = -offsetPx.current;
    if (offsetPx.current <= -img.offsetWidth) offsetPx.current += img.offsetWidth;
    if (offsetPx.current > 0) offsetPx.current -= img.offsetWidth;
    applyOffset();
  }

  function onPointerUp() {
    dragging.current = false;
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black select-none">

      <div
        ref={containerRef}
        className="absolute inset-0 overflow-hidden cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div ref={wrapperRef} className="flex h-full" style={{ willChange: "transform", transform: "scale(1.1)", transformOrigin: "center center" }}>
          <img
            ref={imgRef}
            src="/laurai-beach.png"
            alt=""
            draggable={false}
            className="h-full w-auto max-w-none shrink-0"
          />
          <img
            src="/laurai-beach.png"
            alt=""
            draggable={false}
            className="h-full w-auto max-w-none shrink-0"
          />
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />

      <div
        className="absolute bottom-16 left-0 right-0 flex flex-col items-center transition-opacity duration-[1500ms] ease-in-out pointer-events-none"
        style={{ opacity: textVisible ? 1 : 0 }}
      >
        <p className="text-sm font-medium tracking-wide text-white/90">
          LaurAI turns chaos into clarity. Enjoy.
        </p>
      </div>

      <button
        onClick={() => router.back()}
        aria-label="Go back"
        className="absolute bottom-6 left-6 flex items-center gap-1.5 text-white/50 hover:text-white/90 transition-colors duration-300"
      >
        <ChevronLeft className="h-5 w-5" />
        <span className="text-xs font-medium tracking-wide">Back</span>
      </button>
    </div>
  );
}
