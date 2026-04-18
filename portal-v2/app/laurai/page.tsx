"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

const CROSSFADE = 1;
const RATE = 0.75;

export default function LaurAIPage() {
  const router = useRouter();
  const [textVisible, setTextVisible] = useState(false);
  const videoA = useRef<HTMLVideoElement>(null);
  const videoB = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const fadeIn = setTimeout(() => setTextVisible(true), 800);
    const fadeOut = setTimeout(() => setTextVisible(false), 5000);
    return () => {
      clearTimeout(fadeIn);
      clearTimeout(fadeOut);
    };
  }, []);

  // Ambient audio — start on first user interaction (browser autoplay policy)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let started = false;
    function tryPlay() {
      if (started) return;
      started = true;
      audio!.volume = 0;
      audio!.play().then(() => {
        let vol = 0;
        const fade = setInterval(() => {
          vol = Math.min(vol + 0.02, 1);
          audio!.volume = vol;
          if (vol >= 1) clearInterval(fade);
        }, 80);
      }).catch(() => { started = false; });
      document.removeEventListener("click", tryPlay, true);
      document.removeEventListener("touchstart", tryPlay, true);
      document.removeEventListener("keydown", tryPlay, true);
    }

    // Try immediately (works if navigated via user click)
    audio.play().then(() => {
      started = true;
      audio.volume = 0;
      let vol = 0;
      const fade = setInterval(() => {
        vol = Math.min(vol + 0.02, 1);
        audio.volume = vol;
        if (vol >= 1) clearInterval(fade);
      }, 80);
    }).catch(() => {
      // Autoplay blocked — wait for any user gesture
      document.addEventListener("click", tryPlay, true);
      document.addEventListener("touchstart", tryPlay, true);
      document.addEventListener("keydown", tryPlay, true);
    });

    return () => {
      audio.pause();
      document.removeEventListener("click", tryPlay, true);
      document.removeEventListener("touchstart", tryPlay, true);
      document.removeEventListener("keydown", tryPlay, true);
    };
  }, []);

  const initVideo = useCallback((el: HTMLVideoElement | null) => {
    if (el) el.playbackRate = RATE;
  }, []);

  useEffect(() => {
    const a = videoA.current;
    const b = videoB.current;
    if (!a || !b) return;

    let crossfading = false;

    function tick() {
      if (!a || !b) return;
      const dur = a.duration;
      if (!dur || isNaN(dur)) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const timeLeft = dur - a.currentTime;
      if (timeLeft <= CROSSFADE) {
        if (!crossfading) {
          crossfading = true;
          b.currentTime = 0;
          b.play();
        }
        const t = 1 - timeLeft / CROSSFADE;
        b.style.opacity = String(t);
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    function onAEnded() {
      a!.currentTime = 0;
      a!.play();
      b!.pause();
      b!.style.opacity = "0";
      crossfading = false;
    }

    a.addEventListener("ended", onAEnded);
    a.loop = false;
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      a.removeEventListener("ended", onAEnded);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black select-none">

      <audio ref={audioRef} src="/laurai-ambient.mp3" loop preload="auto" />

      <video
        ref={(el) => { (videoA as any).current = el; initVideo(el); }}
        src="/laurai-beach.mp4"
        autoPlay
        muted
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
      />
      <video
        ref={(el) => { (videoB as any).current = el; initVideo(el); }}
        src="/laurai-beach.mp4"
        muted
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
        style={{ opacity: 0 }}
      />

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
