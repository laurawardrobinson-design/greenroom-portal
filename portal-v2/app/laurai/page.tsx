"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

const RATE = 0.75;

type CrisisFlavor = "bubble-gum" | "dark-night" | "head-in-sand";

const FLAVOR_AUDIO: Record<CrisisFlavor, string> = {
  "bubble-gum": "/laurai-bubble-gum.mp3",
  "dark-night": "/laurai-dark-night.mp3",
  "head-in-sand": "/laurai-ambient.mp3",
};

function SweepingPinkLights({ audio }: { audio: HTMLAudioElement | null }) {
  // Start invisible; fade in after the video has faded up (~3s).
  const [on, setOn] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = setTimeout(() => setOn(true), 1500);
    return () => clearTimeout(t);
  }, []);

  // Cue sequence, patterned like a real dance-pop show —
  // establish, build, drop, release, repeat. Swirl and cross are the "drop" cues;
  // down and point are punctuation; independent is the verse.
  type UnisonMode = null | "down" | "swirl" | "point" | "cross" | "fan" | "chase" | "blackout" | "counter";
  const [unison, setUnison] = useState<UnisonMode>(null);
  useEffect(() => {
    // Sequence patterned after EDM song structure:
    // verse (independent, restrained) → build (fan/cross, accelerating) →
    // pre-drop blackout (220ms) → drop (swirl/ballyhoo) → release → repeat.
    const cues: Array<[UnisonMode, number]> = [
      [null, 12000],        // verse
      ["fan", 5000],        // build — rigs open wider
      ["blackout", 120],    // pre-drop snap
      ["swirl", 7000],      // drop — ballyhoo
      ["counter", 5000],    // center reverses — counter-rotating ballyhoo
      [null, 6000],         // release — cool down
      ["chase", 6000],      // bridge — left→center→right wave
      ["cross", 4500],      // build — X pattern
      ["blackout", 120],    // pre-drop snap
      ["swirl", 8000],      // bigger drop
      ["counter", 5000],    // opposite-direction encore
      [null, 10000],        // verse
      ["down", 3500],       // hit — all straight down (with flicker)
      ["fan", 4000],        // build
      ["blackout", 120],    // snap
      ["swirl", 9000],      // biggest drop
      ["counter", 6000],    // counter-swirl outro
      ["point", 2500],      // final stab
    ];
    let idx = 0;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      const [mode, dur] = cues[idx % cues.length];
      setUnison(mode);
      idx += 1;
      timer = setTimeout(step, dur);
    };
    // Let the independent show run first for ~8s, then start cueing.
    timer = setTimeout(step, 8000);
    return () => clearTimeout(timer);
  }, []);

  // Web Audio beat analyser — sets a CSS var `--beat` (0..1) on the root.
  useEffect(() => {
    if (!audio || !rootRef.current) return;
    const root = rootRef.current;
    let ctx: AudioContext | null = null;
    let raf = 0;
    let smoothed = 0;
    try {
      ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const source = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteFrequencyData(data);
        // Bass: first ~6 bins (roughly 0–250Hz at 48kHz).
        let sum = 0;
        for (let i = 0; i < 6; i++) sum += data[i];
        const level = sum / (6 * 255); // 0..1
        // Smooth a little, with fast attack and slower decay so peaks punch.
        if (level > smoothed) smoothed = level;
        else smoothed = smoothed * 0.85 + level * 0.15;
        root.style.setProperty("--beat", smoothed.toFixed(3));
        raf = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // createMediaElementSource throws if already created for this element.
    }
    return () => {
      cancelAnimationFrame(raf);
      try { ctx?.close(); } catch {}
    };
  }, [audio]);

  // Soft roaming spotlights (fast)
  const spots = [
    { dur: 4.5, delay: 0, size: 60, blur: 70, color: "rgba(255,82,180,0.9)", t1: [-30, -20], t2: [90, -5] },
    { dur: 5.5, delay: 0.8, size: 55, blur: 80, color: "rgba(255,140,220,0.8)", t1: [95, 15], t2: [-25, 5] },
    { dur: 3.8, delay: 0.4, size: 50, blur: 60, color: "rgba(255,200,240,0.95)", t1: [20, -10], t2: [60, 20] },
    { dur: 6.2, delay: 1.5, size: 70, blur: 90, color: "rgba(255,60,150,0.75)", t1: [-40, 30], t2: [100, -15] },
  ];
  // Three motion-control rigs overhead, spread wide. All lasers emanate from one of these points.
  const rigs = [
    { x: 12, y: -2 }, // Left
    { x: 50, y: -2 }, // Center
    { x: 88, y: -2 }, // Right
  ];
  // Each rig has 4 lasers with independent sweep patterns (unique waypoints + prime durations).
  const lasers = [
    // Left rig
    { rig: 0, waypoints: [-50, 40, -10], dur: 7.3, delay: 0, width: 3 },
    { rig: 0, waypoints: [55, -30, 20], dur: 9.7, delay: 0.6, width: 2 },
    { rig: 0, waypoints: [-25, 65, 10], dur: 5.9, delay: 1.2, width: 3 },
    { rig: 0, waypoints: [35, -60, -5], dur: 8.1, delay: 0.4, width: 2 },
    // Center rig
    { rig: 1, waypoints: [-65, 50, -15], dur: 6.1, delay: 0.3, width: 3 },
    { rig: 1, waypoints: [55, -60, 25], dur: 8.9, delay: 0.9, width: 4 },
    { rig: 1, waypoints: [-35, 35, -50], dur: 4.7, delay: 1.5, width: 2 },
    { rig: 1, waypoints: [20, -25, 60], dur: 7.9, delay: 0.7, width: 3 },
    // Right rig
    { rig: 2, waypoints: [-40, 25, 50], dur: 10.7, delay: 0.5, width: 3 },
    { rig: 2, waypoints: [30, -55, 15], dur: 5.7, delay: 1.1, width: 2 },
    { rig: 2, waypoints: [-10, 60, -35], dur: 8.3, delay: 0.2, width: 3 },
    { rig: 2, waypoints: [45, -20, -55], dur: 6.3, delay: 1.4, width: 2 },
  ];
  // Radial bursts — lasers pointing toward the camera
  const bursts = [
    { dur: 7, delay: 0.5, x: 40, y: 30, color: "rgba(255,120,210,0.9)" },
    { dur: 9, delay: 3, x: 70, y: 45, color: "rgba(255,200,240,1)" },
    { dur: 6, delay: 5, x: 25, y: 60, color: "rgba(255,80,180,0.95)" },
  ];

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-[2500ms] ease-in-out"
      style={{
        mixBlendMode: "screen",
        opacity: on ? (unison === "blackout" ? 0 : 1) : 0,
        transitionDuration: unison === "blackout" ? "80ms" : "2500ms",
        filter: "brightness(calc(0.75 + var(--beat, 0.3) * 0.6))",
      } as React.CSSProperties}
    >
      <style>{`
        @keyframes laurai-unison-down {
          0%, 100% { transform: rotate(-18deg); }
          50% { transform: rotate(18deg); }
        }
        /* Quick flicker variants used during the vertical-stack (down) cue. */
        @keyframes laurai-flicker-0 {
          0%,10%,28%,40%,58%,70%,88%,100% { opacity: 1; }
          11%,27%,41%,57%,71%,87% { opacity: 0; }
        }
        @keyframes laurai-flicker-1 {
          0%,18%,36%,52%,68%,82%,100% { opacity: 1; }
          19%,35%,53%,67%,83%,99% { opacity: 0; }
        }
        @keyframes laurai-flicker-2 {
          0%,8%,24%,38%,56%,74%,92%,100% { opacity: 1; }
          9%,23%,39%,55%,75%,91% { opacity: 0; }
        }
        @keyframes laurai-flicker-3 {
          0%,15%,32%,48%,66%,80%,94%,100% { opacity: 1; }
          16%,31%,49%,65%,81%,93% { opacity: 0; }
        }
        /* Slower, sparser flickers used during the independent phase — tasteful,
           not strobey: each laser stays on for most of its cycle and blinks off briefly. */
        @keyframes laurai-idle-blink-0 {
          0%,42%,45%,100% { opacity: 1; }
          43%,44% { opacity: 0; }
        }
        @keyframes laurai-idle-blink-1 {
          0%,68%,71%,100% { opacity: 1; }
          69%,70% { opacity: 0; }
        }
        @keyframes laurai-idle-blink-2 {
          0%,20%,24%,82%,85%,100% { opacity: 1; }
          21%,23%,83%,84% { opacity: 0; }
        }
        @keyframes laurai-idle-blink-3 {
          0%,55%,58%,100% { opacity: 1; }
          56%,57% { opacity: 0; }
        }
        @keyframes laurai-unison-swirl {
          0% { transform: rotate(-60deg); }
          100% { transform: rotate(300deg); }
        }
        @keyframes laurai-unison-swirl-ccw {
          0% { transform: rotate(60deg); }
          100% { transform: rotate(-300deg); }
        }
        @keyframes laurai-unison-point {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(0deg); }
        }
        /* Cross — each rig angles inward, slight sway. */
        @keyframes laurai-cross-0 { 0%,100% { transform: rotate(38deg); } 50% { transform: rotate(55deg); } }
        @keyframes laurai-cross-1 { 0%,100% { transform: rotate(-8deg); } 50% { transform: rotate(8deg); } }
        @keyframes laurai-cross-2 { 0%,100% { transform: rotate(-55deg); } 50% { transform: rotate(-38deg); } }
        /* Fan — each rig opens wide then closes, in unison across all 3 rigs. */
        @keyframes laurai-fan-0 { 0%,100% { transform: rotate(-60deg); } 50% { transform: rotate(10deg); } }
        @keyframes laurai-fan-1 { 0%,100% { transform: rotate(-40deg); } 50% { transform: rotate(40deg); } }
        @keyframes laurai-fan-2 { 0%,100% { transform: rotate(60deg); } 50% { transform: rotate(-10deg); } }
        /* Chase — same wave motion on all 3 rigs, phase-offset by rig so it reads left→center→right. */
        @keyframes laurai-chase {
          0%   { transform: rotate(-45deg); opacity: 0.25; }
          20%  { transform: rotate(-25deg); opacity: 1; }
          40%  { transform: rotate(25deg); opacity: 1; }
          60%  { transform: rotate(45deg); opacity: 0.25; }
          100% { transform: rotate(-45deg); opacity: 0.25; }
        }
        ${spots.map((s, i) => `
          @keyframes laurai-spot-${i} {
            0%, 100% { transform: translate(${s.t1[0]}%, ${s.t1[1]}%); }
            50% { transform: translate(${s.t2[0]}%, ${s.t2[1]}%); }
          }
        `).join("")}
        ${lasers.map((l, i) => {
          // Close the loop by appending the first waypoint at the end — otherwise
          // the animation snaps from waypoint[last] back to waypoint[0] on each
          // iteration, creating a visible "gap" in the motion.
          const pts = [...l.waypoints, l.waypoints[0]];
          const stops = pts.map((w, j) =>
            `${((j / (pts.length - 1)) * 100).toFixed(2)}% { transform: rotate(${w}deg); }`
          ).join(" ");
          return `@keyframes laurai-laser-${i} { ${stops} }`;
        }).join("")}
        ${bursts.map((_, i) => `
          @keyframes laurai-burst-${i} {
            0%, 85%, 100% { opacity: 0; transform: scale(0.6); }
            90% { opacity: 1; transform: scale(1.4); }
            95% { opacity: 0.3; transform: scale(1.2); }
          }
        `).join("")}
      `}</style>

      {/* Soft spotlights */}
      {spots.map((s, i) => (
        <div
          key={`spot-${i}`}
          className="absolute"
          style={{
            top: "-30%",
            left: 0,
            width: `${s.size}%`,
            height: "160%",
            background: `radial-gradient(ellipse at center, ${s.color}, rgba(255,120,200,0.25) 40%, transparent 70%)`,
            filter: `blur(${s.blur}px)`,
            animation: `laurai-spot-${i} ${s.dur}s ease-in-out infinite`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}

      {/* Rig fixtures — the visible "lights" on the ceiling */}
      {rigs.map((r, i) => (
        <div
          key={`rig-${i}`}
          className="absolute rounded-full"
          style={{
            top: `${r.y}%`,
            left: `${r.x}%`,
            width: "36px",
            height: "36px",
            marginLeft: "-18px",
            marginTop: "-18px",
            background: "radial-gradient(circle, rgba(255,220,240,0.7) 0%, rgba(255,150,210,0.4) 40%, transparent 70%)",
            filter: "blur(4px)",
          }}
        />
      ))}

      {/* Lasers — each tied to one of the 3 overhead rigs */}
      {lasers.map((l, i) => {
        const r = rigs[l.rig];
        // During a unison cue, every laser runs the SAME animation shape — but each
        // laser within a rig gets a phase-offset via negative animation-delay so the
        // 4 beams fan out instead of stacking on top of each other.
        const indexInRig = i % 4;
        const modeDur: Partial<Record<NonNullable<UnisonMode>, number>> = {
          down: 2.5,
          swirl: 3.5,
          cross: 3.2,
          fan: 2.2,
          chase: 2.8,
          counter: 3.8,
        };
        // Per-rig swirl duration — tuned to feel musical (8-beat rotations at ~120bpm).
        const swirlRigDurs = [3.8, 4.2, 4.0];
        let animDur = unison && modeDur[unison] ? modeDur[unison]! : 0;
        if (unison === "swirl") animDur = swirlRigDurs[l.rig];
        if (unison === "counter") animDur = swirlRigDurs[l.rig] + 0.4;
        const perLaserPhase = animDur ? -(indexInRig * animDur) / 4 : 0;
        // Chase rigs are phase-shifted L→C→R; beams within a rig also fan slightly.
        const chaseRigOffset = unison === "chase" ? -(l.rig * animDur) / 3 : 0;
        const flickerDurs = [0.9, 0.75, 1.1, 0.85];
        const downAnim =
          unison === "down"
            ? `laurai-unison-down ${animDur}s ease-in-out infinite, laurai-flicker-${indexInRig} ${flickerDurs[indexInRig]}s steps(1, end) infinite`
            : null;
        // Swirl: center rig rotates opposite the outer rigs (always).
        // Counter: full inversion — outer rigs CCW, center rig CW.
        const swirlName = l.rig === 1 ? "laurai-unison-swirl-ccw" : "laurai-unison-swirl";
        const counterName = l.rig === 1 ? "laurai-unison-swirl" : "laurai-unison-swirl-ccw";
        const unisonAnim =
          downAnim
            ? downAnim
            : unison === "swirl"
              ? `${swirlName} ${animDur}s linear infinite`
              : unison === "counter"
                ? `${counterName} ${animDur}s linear infinite`
                : unison === "point"
                  ? "laurai-unison-point 0.1s linear forwards"
                  : unison === "cross"
                    ? `laurai-cross-${l.rig} ${animDur}s ease-in-out infinite`
                    : unison === "fan"
                      ? `laurai-fan-${l.rig} ${animDur}s ease-in-out infinite`
                      : unison === "chase"
                        ? `laurai-chase ${animDur}s ease-in-out infinite`
                        : null;
        const flickerStartOffsets = [0, -0.27, -0.55, -0.83];
        const unisonDelay = unison
          ? unison === "down"
            ? `${(perLaserPhase).toFixed(3)}s, ${flickerStartOffsets[indexInRig].toFixed(3)}s`
            : `${(perLaserPhase + chaseRigOffset).toFixed(3)}s`
          : "0s";
        // Static per-laser angle offset during unison so 4 beams fan instead of stacking.
        // Indices 0..3 map to -15, -5, +5, +15 degrees.
        const unisonStaticOffset = unison ? (indexInRig - 1.5) * 10 : 0;
        return (
        <div
          key={`laser-${i}-${unison ?? "free"}`}
          className="absolute"
          style={{
            top: `${r.y}%`,
            left: `${r.x}%`,
            width: `${l.width}px`,
            height: "220%",
            transformOrigin: "top center",
            animation: unisonAnim
              ? unisonAnim
              : `laurai-laser-${i} ${l.dur}s ease-in-out infinite`,
            animationDelay: unisonAnim ? unisonDelay : `${l.delay}s`,
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              transformOrigin: "top center",
              transform: unisonStaticOffset ? `rotate(${unisonStaticOffset}deg)` : undefined,
            }}
          >
            <div
              className="absolute inset-y-0"
              style={{
                left: "-14px",
                right: "-14px",
                background:
                  "linear-gradient(to bottom, rgba(255,40,140,0.6) 0%, rgba(255,60,160,0.45) 60%, rgba(255,60,160,0.25) 100%)",
                filter: "blur(8px)",
              }}
            />
            <div
              className="absolute inset-y-0 left-0 right-0"
              style={{
                background:
                  "linear-gradient(to bottom, rgba(255,180,220,0.95) 0%, rgba(255,100,180,0.9) 20%, rgba(255,60,160,0.8) 65%, rgba(230,30,130,0.6) 100%)",
              }}
            />
          </div>
        </div>
        );
      })}

      {/* Camera-facing bursts */}
      {bursts.map((b, i) => (
        <div
          key={`burst-${i}`}
          className="absolute rounded-full"
          style={{
            top: `${b.y}%`,
            left: `${b.x}%`,
            width: "30vmin",
            height: "30vmin",
            marginLeft: "-15vmin",
            marginTop: "-15vmin",
            background: `radial-gradient(circle, ${b.color} 0%, rgba(255,150,220,0.5) 30%, transparent 65%)`,
            filter: "blur(20px)",
            animation: `laurai-burst-${i} ${b.dur}s ease-in-out infinite`,
            animationDelay: `${b.delay}s`,
            opacity: 0,
          }}
        />
      ))}
    </div>
  );
}

function FadeInVideo({
  src,
  durationMs,
  filter,
}: {
  src: string;
  durationMs: number;
  filter?: string;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);
  return (
    <video
      src={src}
      autoPlay
      loop
      muted
      playsInline
      className="absolute inset-0 h-full w-full object-cover transition-opacity ease-in-out"
      style={{
        opacity: visible ? 1 : 0,
        transitionDuration: `${durationMs}ms`,
        filter,
      }}
    />
  );
}

export default function LaurAIPage() {
  const router = useRouter();
  const [textVisible, setTextVisible] = useState(false);
  const [crisisOpen, setCrisisOpen] = useState(true);
  const [pendingFlavor, setPendingFlavor] = useState<CrisisFlavor | null>(null);
  const [activeFlavor, setActiveFlavor] = useState<CrisisFlavor | null>(null);
  const [currentAudioEl, setCurrentAudioEl] = useState<HTMLAudioElement | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const [volume, setVolume] = useState(0.4);
  const [muted, setMuted] = useState(false);
  const volumeRef = useRef(0.4);
  const mutedRef = useRef(false);
  const fadeInRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Apply volume/mute changes directly (and cancel any in-progress fade-in) so
  // the slider feels responsive.
  useEffect(() => {
    volumeRef.current = volume;
    mutedRef.current = muted;
    if (currentAudioRef.current) {
      if (fadeInRef.current) {
        clearInterval(fadeInRef.current);
        fadeInRef.current = null;
      }
      currentAudioRef.current.volume = muted ? 0 : volume;
    }
  }, [volume, muted]);

  useEffect(() => {
    const fadeIn = setTimeout(() => setTextVisible(true), 800);
    const fadeOut = setTimeout(() => setTextVisible(false), 5000);
    return () => {
      clearTimeout(fadeIn);
      clearTimeout(fadeOut);
    };
  }, []);

  // Crossfade audio whenever activeFlavor changes.
  useEffect(() => {
    const prev = currentAudioRef.current;

    // Fade out whatever was playing.
    if (prev) {
      const startVol = prev.volume;
      const steps = 24;
      let i = 0;
      const fadeOutId = setInterval(() => {
        i += 1;
        prev.volume = Math.max(0, startVol * (1 - i / steps));
        if (i >= steps) {
          clearInterval(fadeOutId);
          prev.pause();
          prev.src = "";
        }
      }, 50);
    }

    if (!activeFlavor) {
      currentAudioRef.current = null;
      setCurrentAudioEl(null);
      return;
    }

    // Fade in the new track.
    const el = new Audio(FLAVOR_AUDIO[activeFlavor]);
    el.crossOrigin = "anonymous";
    el.loop = true;
    el.volume = 0;
    currentAudioRef.current = el;
    setCurrentAudioEl(el);
    el.play()
      .then(() => {
        let v = 0;
        if (fadeInRef.current) clearInterval(fadeInRef.current);
        fadeInRef.current = setInterval(() => {
          v = Math.min(volumeRef.current, v + 0.035);
          el.volume = mutedRef.current ? 0 : v;
          if (v >= volumeRef.current) {
            if (fadeInRef.current) clearInterval(fadeInRef.current);
            fadeInRef.current = null;
          }
        }, 50);
      })
      .catch(() => {
        // Autoplay blocked — radio click is a user gesture so this is unlikely.
      });
  }, [activeFlavor]);

  // Clean up audio on unmount.
  useEffect(() => {
    return () => {
      const el = currentAudioRef.current;
      if (el) {
        el.pause();
        currentAudioRef.current = null;
      }
    };
  }, []);

  const initVideo = useCallback((el: HTMLVideoElement | null) => {
    if (el) el.playbackRate = RATE;
  }, []);

  const showBeach = activeFlavor === "head-in-sand";
  const showDarkNight = activeFlavor === "dark-night";
  const showBubbleGum = activeFlavor === "bubble-gum";

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black select-none">
      {showBeach && (
        <video
          ref={initVideo}
          key="beach"
          src="/laurai-beach.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {showDarkNight && (
        <>
          <video
            key="dark-night"
            src="/laurai-dark-night.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/50 pointer-events-none" />
        </>
      )}

      {showBubbleGum && (
        <>
          <FadeInVideo
            key="bubble-gum"
            src="/laurai-bubble-gum.mp4"
            durationMs={3000}
            filter="brightness(1.25) saturate(1.15)"
          />
          <SweepingPinkLights audio={currentAudioEl} />
        </>
      )}

      {showBeach && (
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
      )}

      {showBeach && (
        <div
          className="absolute bottom-16 left-0 right-0 flex flex-col items-center transition-opacity duration-[1500ms] ease-in-out pointer-events-none"
          style={{ opacity: textVisible ? 1 : 0 }}
        >
          <p className="text-sm font-medium tracking-wide text-white/90">
            LaurAI turns chaos into clarity. Enjoy.
          </p>
        </div>
      )}

      {/* Click-anywhere surface to re-open the selector */}
      <button
        type="button"
        onClick={() => {
          setPendingFlavor(activeFlavor);
          setCrisisOpen(true);
        }}
        aria-label="Begin existential crisis"
        className="absolute inset-0 h-full w-full cursor-pointer bg-transparent"
      />

      <button
        onClick={() => router.push("/login")}
        aria-label="Go back"
        className="absolute bottom-6 left-6 z-40 flex items-center gap-1.5 text-white/50 hover:text-white/90 transition-colors duration-300"
      >
        <ChevronLeft className="h-5 w-5" />
        <span className="text-xs font-medium tracking-wide">Back</span>
      </button>

      {/* Volume slider — lower right, shown only when a scene is active. */}
      {activeFlavor && (
        <div className="absolute bottom-6 right-6 z-40 flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-2 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? "Unmute" : "Mute"}
            className="flex items-center justify-center text-white/70 hover:text-white transition-colors"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {muted || volume === 0 ? (
                <>
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </>
              ) : (
                <>
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  {volume > 0.3 && <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />}
                  {volume > 0.7 && <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />}
                </>
              )}
            </svg>
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => {
              setVolume(parseFloat(e.target.value));
              if (muted) setMuted(false);
            }}
            aria-label="Volume"
            className="h-1 w-28 cursor-pointer appearance-none rounded-full bg-white/20 accent-white [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
            style={{ opacity: muted ? 0.4 : 1 }}
          />
        </div>
      )}

      {crisisOpen && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm transition-opacity duration-500"
          role="dialog"
          aria-modal="true"
          aria-labelledby="crisis-title"
          onClick={() => setCrisisOpen(false)}
        >
          <div
            className="mx-6 w-full max-w-md rounded-2xl border border-white/10 bg-black/60 p-8 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="crisis-title"
              className="text-xl font-medium tracking-wide text-white text-balance"
            >
              How do you take your existential crisis?
            </h2>
            <p className="mt-2 text-sm text-white/60">Choose one.</p>

            <div className="mt-8 flex flex-col gap-3">
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                  pendingFlavor === "bubble-gum"
                    ? "border-pink-300/80 bg-pink-300/10"
                    : "border-white/15 hover:border-white/40"
                }`}
              >
                <input
                  type="radio"
                  name="crisis-flavor"
                  value="bubble-gum"
                  checked={pendingFlavor === "bubble-gum"}
                  onChange={() => setPendingFlavor("bubble-gum")}
                  className="accent-pink-300"
                />
                <div>
                  <div className="text-sm font-medium text-white">Bubble Gum</div>
                  <div className="text-xs text-white/60">
                    Sweet, pink, dissolves in minutes.
                  </div>
                </div>
              </label>

              <label
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                  pendingFlavor === "dark-night"
                    ? "border-indigo-300/80 bg-indigo-300/10"
                    : "border-white/15 hover:border-white/40"
                }`}
              >
                <input
                  type="radio"
                  name="crisis-flavor"
                  value="dark-night"
                  checked={pendingFlavor === "dark-night"}
                  onChange={() => setPendingFlavor("dark-night")}
                  className="accent-indigo-300"
                />
                <div>
                  <div className="text-sm font-medium text-white">
                    Dark Night of the Soul
                  </div>
                  <div className="text-xs text-white/60">
                    Slow-burn, lasts until dawn.
                  </div>
                </div>
              </label>

              <label
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                  pendingFlavor === "head-in-sand"
                    ? "border-amber-200/80 bg-amber-200/10"
                    : "border-white/15 hover:border-white/40"
                }`}
              >
                <input
                  type="radio"
                  name="crisis-flavor"
                  value="head-in-sand"
                  checked={pendingFlavor === "head-in-sand"}
                  onChange={() => setPendingFlavor("head-in-sand")}
                  className="accent-amber-200"
                />
                <div>
                  <div className="text-sm font-medium text-white">
                    Head in the Sand
                  </div>
                  <div className="text-xs text-white/60">
                    What crisis? Everything&apos;s fine.
                  </div>
                </div>
              </label>
            </div>

            <div className="mt-8 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setPendingFlavor(null);
                  setActiveFlavor(null);
                  router.push("/login");
                }}
                className="rounded-full border border-white/20 px-5 py-2 text-xs font-medium tracking-wide text-white/70 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!pendingFlavor}
                onClick={() => {
                  setActiveFlavor(pendingFlavor);
                  setCrisisOpen(false);
                }}
                className="rounded-full bg-white px-5 py-2 text-xs font-medium tracking-wide text-black transition-opacity disabled:opacity-40"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
