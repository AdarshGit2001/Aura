"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  AudioLines,
  Bot,
  Camera,
  Check,
  ChevronDown,
  CircleDot,
  Eye,
  Github,
  Headphones,
  Layers3,
  Mic2,
  Pause,
  Play,
  ShieldAlert,
  Sparkles,
  Target,
  Users,
  Volume2,
  X,
  Zap,
} from "lucide-react";
import { demoScenes, type AuraObservation, type SceneKind } from "@/lib/demo-scenes";

const repoUrl = process.env.NEXT_PUBLIC_REPO_URL || "https://github.com/your-team/aura";
const pptUrl = process.env.NEXT_PUBLIC_PPT_URL || "#";

const featureCards = [
  {
    icon: Eye,
    kicker: "01 · PERCEIVE",
    title: "Understand the scene",
    text: "Gemini interprets each selected frame into people, layout, hazards, motion and context — not just object labels."
  },
  {
    icon: Target,
    kicker: "02 · TRIAGE",
    title: "Decide what matters",
    text: "Aura scores context, suppresses noise and changes priority when a safety event appears."
  },
  {
    icon: Headphones,
    kicker: "03 · NARRATE",
    title: "Speak like a companion",
    text: "Only the most decision-relevant context becomes a short, natural sentence played to the user."
  }
];

const useCases = [
  ["01", "Walking through a room", "Narrates a clear path and a notable person while ignoring static furniture."],
  ["02", "Approaching stairs", "Interrupts current narration to call out a step-down hazard before anything else."],
  ["03", "Entering a social setting", "Surfaces who is present and broad activity rather than describing every object."],
  ["04", "Crowded spaces", "Tracks moving people and flags collision risks while suppressing static surroundings."]
];

function normalizeObservation(data: unknown, fallback: AuraObservation): AuraObservation {
  const value = (data && typeof data === "object" ? data : {}) as Partial<AuraObservation>;
  return {
    sceneSummary: typeof value.sceneSummary === "string" ? value.sceneSummary : fallback.sceneSummary,
    narration: typeof value.narration === "string" ? value.narration : fallback.narration,
    safety: typeof value.safety === "boolean" ? value.safety : fallback.safety,
    urgency: value.urgency === "critical" || value.urgency === "high" || value.urgency === "normal" ? value.urgency : fallback.urgency,
    decision: typeof value.decision === "string" ? value.decision : fallback.decision,
    items: Array.isArray(value.items) ? value.items : fallback.items,
    latencyMs: typeof value.latencyMs === "number" && Number.isFinite(value.latencyMs) ? value.latencyMs : fallback.latencyMs,
  };
}

function StatusPill({ label, active = false, danger = false }: { label: string; active?: boolean; danger?: boolean }) {
  return (
    <span className={`status-pill ${active ? "active" : ""} ${danger ? "danger" : ""}`}>
      <span className="status-dot" /> {label}
    </span>
  );
}

function Waveform({ active }: { active: boolean }) {
  return (
    <div className={`waveform ${active ? "speaking" : ""}`} aria-hidden="true">
      {Array.from({ length: 18 }).map((_, i) => <span key={i} style={{ animationDelay: `${i * 50}ms` }} />)}
    </div>
  );
}

export default function AuraApp() {
  const [scene, setScene] = useState<SceneKind>("calm");
  const [observation, setObservation] = useState<AuraObservation>(demoScenes.calm);
  const [cameraOn, setCameraOn] = useState(false);
  const [demoMode, setDemoMode] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [autoTriage, setAutoTriage] = useState(false);
  const autoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analysisBusyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastSpoken, setLastSpoken] = useState("The path ahead is clear.");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (autoTimerRef.current) clearInterval(autoTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!autoTimerRef.current) {
      return;
    }
    clearInterval(autoTimerRef.current);
    autoTimerRef.current = null;
  }, [cameraOn]);

  useEffect(() => {
    if (!cameraOn || !streamRef.current || !videoRef.current) return;

    const video = videoRef.current;
    const stream = streamRef.current;
    video.srcObject = stream;

    const playVideo = async () => {
      try {
        await video.play();
      } catch (err) {
        console.error("Camera playback failed:", err);
        setCameraError("Camera opened, but the browser did not start video playback.");
      }
    };

    if (video.readyState >= 2) {
      void playVideo();
    } else {
      video.addEventListener("loadedmetadata", playVideo, { once: true });
    }

    return () => {
      video.removeEventListener("loadedmetadata", playVideo);
    };
  }, [cameraOn]);

  useEffect(() => {
    if (autoTimerRef.current) clearInterval(autoTimerRef.current);
    if (!autoTriage || !cameraOn) return;
    autoTimerRef.current = setInterval(() => {
      if (!analysisBusyRef.current) void analyzeFrame();
    }, 3000);
    return () => {
      if (autoTimerRef.current) clearInterval(autoTimerRef.current);
    };
  }, [autoTriage, cameraOn]);

  const speak = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.02;
    utterance.pitch = 1;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setLastSpoken(text);
  };

  const loadDemo = (kind: SceneKind) => {
    setScene(kind);
    const next = demoScenes[kind];
    setObservation(next);
    setError(null);
    speak(next.narration);
  };

  const startCamera = async () => {
    setCameraError(null);
    setError(null);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("This browser does not support camera access.");
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      setCameraOn(true);
      setDemoMode(false);
    } catch (err) {
      console.error("Camera access failed:", err);
      streamRef.current = null;
      setCameraError(err instanceof Error ? err.message : "Camera access was blocked.");
      setDemoMode(true);
      setCameraOn(false);
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
    setAutoTriage(false);
  };

  const analyzeFrame = async () => {
    if (!videoRef.current || !cameraOn || analysisBusyRef.current) return;
    analysisBusyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const video = videoRef.current;

      // Wait until the camera has produced real video dimensions before capturing.
      if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
        await new Promise((resolve) => setTimeout(resolve, 400));
      }

      if (video.videoWidth === 0 || video.videoHeight === 0) {
        throw new Error("Camera is on, but no video frames are available yet. Wait a moment and try again.");
      }

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not read the camera frame.");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = canvas.toDataURL("image/jpeg", 0.82);

      const response = await fetch("/api/aura/observe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, context: lastSpoken })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Aura could not analyze this frame.");
      const nextObservation = normalizeObservation(data, observation);
      setObservation(nextObservation);
      if (nextObservation.narration) speak(nextObservation.narration);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      analysisBusyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Aura home">
          <span className="brand-mark"><Sparkles size={17} /></span>
          <span>AURA</span>
        </a>
        <nav className="nav-links">
          <a href="#experience">Experience</a>
          <a href="#how">How it works</a>
          <a href="#use-cases">Use cases</a>
          <a href="#hackathon">Hackathon</a>
        </nav>
        <a className="nav-cta" href="#experience">Try the live demo <ArrowRight size={15} /></a>
      </header>

      <section id="top" className="hero section-shell">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> Agentic & Autonomous Systems · FAR AWAY 2026</div>
          <h1>See less.<br /><em>Understand more.</em></h1>
          <p className="hero-lede">Aura is an agentic sensory narrator that turns the world in front of a camera into the small amount of context that actually matters — spoken in real time.</p>
          <div className="hero-actions">
            <a className="button primary" href="#experience">Enter the experience <ArrowRight size={17} /></a>
            <a className="button ghost" href={pptUrl} target={pptUrl !== "#" ? "_blank" : undefined} rel="noreferrer">Round 1 deck <Layers3 size={16} /></a>
          </div>
          <div className="hero-proof">
            <div><strong>2.2B</strong><span>people living with vision impairment*</span></div>
            <div><strong>1.5s</strong><span>target frame-to-speech latency</span></div>
            <div><strong>70%+</strong><span>irrelevant detail suppressed</span></div>
          </div>
          <p className="microcopy">*Context from the project PRD. The demo is designed for Round 1 and uses commodity camera hardware.</p>
        </div>

        <div className="hero-visual" aria-label="Aura sensory narrator visualization">
          <div className="halo halo-a" />
          <div className="halo halo-b" />
          <div className="hero-orb">
            <div className="orb-core"><AudioLines size={48} strokeWidth={1.25} /></div>
            <span className="orb-tag orb-tag-a">PERCEIVE</span>
            <span className="orb-tag orb-tag-b">DECIDE</span>
            <span className="orb-tag orb-tag-c">NARRATE</span>
          </div>
          <div className="hero-floating hero-floating-a"><CircleDot size={13} /> Scene meaning</div>
          <div className="hero-floating hero-floating-b"><ShieldAlert size={13} /> Safety priority</div>
          <div className="hero-floating hero-floating-c"><Volume2 size={13} /> Natural speech</div>
          <div className="visual-caption"><span>Autonomy is the product.</span><span>Not object detection.</span></div>
        </div>
      </section>

      <section className="marquee-bar"><div>PERCEIVE <span>✦</span> TRIAGE <span>✦</span> NARRATE <span>✦</span> CONTEXT &gt; CLUTTER <span>✦</span> SAFETY WINS <span>✦</span> </div></section>

      <section id="experience" className="section-shell experience-section">
        <div className="section-heading">
          <div><div className="section-kicker">LIVE PROOF OF AGENCY</div><h2>Watch Aura make a decision.</h2></div>
          <p>Open the camera or use the scripted scenes. The dashboard deliberately exposes what Aura saw, what it chose to say, and what it suppressed.</p>
        </div>

        <div className="demo-grid">
          <div className="camera-card panel">
            <div className="panel-topline">
              <div className="panel-title"><Camera size={16} /> SENSORY FEED</div>
              <StatusPill label={cameraOn ? "CAMERA LIVE" : "DEMO READY"} active={cameraOn} />
            </div>
            <div className="camera-frame">
              <video
                ref={videoRef}
                className={`camera-video ${cameraOn ? "is-live" : "is-hidden"}`}
                autoPlay
                playsInline
                muted
              />

              {!cameraOn && (
                <div className={`scene-preview scene-${scene}`}>
                  <div className="scene-grid" />
                  <div className="fake-floor" />
                  <div className="fake-person"><span /></div>
                  <div className="fake-object object-a" />
                  <div className="fake-object object-b" />
                  {scene === "stairs" && <div className="fake-stairs"><i /><i /><i /></div>}
                  {scene === "crowd" && <><div className="crowd-person p1" /><div className="crowd-person p2" /><div className="crowd-person p3" /></>}
                </div>
              )}
              <div className="camera-overlay">
                <div className="overlay-chip"><span className="mini-live" /> frame sampling</div>
                <div className="overlay-chip">{busy ? "Gemini reasoning…" : `${Math.max(0.8, observation.latencyMs / 1000).toFixed(2)}s decision`}</div>
              </div>
              {observation.safety && <div className="safety-alert"><ShieldAlert size={17} /> SAFETY PRIORITY · {observation.urgency.toUpperCase()}</div>}
            </div>
            <div className="camera-controls">
              <div className="scene-switcher">
                <button className={scene === "calm" ? "selected" : ""} onClick={() => loadDemo("calm")}>Calm room</button>
                <button className={scene === "stairs" ? "selected" : ""} onClick={() => loadDemo("stairs")}>Step hazard</button>
                <button className={scene === "crowd" ? "selected" : ""} onClick={() => loadDemo("crowd")}>Crowded space</button>
              </div>
              <div className="control-row">
                {!cameraOn ? <button className="button dark" onClick={startCamera}><Camera size={16} /> Use camera</button> : <button className="button soft" onClick={stopCamera}><Pause size={16} /> Stop camera</button>}
                <button className="button outline" onClick={analyzeFrame} disabled={!cameraOn || busy}><Zap size={16} /> {busy ? "Analyzing…" : "Analyze frame"}</button>
              </div>
              {(cameraError || error) && <div className="error-note"><X size={14} /> {cameraError || error}</div>}
            </div>
          </div>

          <div className="triage-column">
            <div className="panel decision-card">
              <div className="panel-topline"><div className="panel-title"><Bot size={16} /> TRIAGE AGENT</div><StatusPill label={observation.safety ? "INTERRUPT" : "LISTENING"} active danger={observation.safety} /></div>
              <div className="decision-main">
                <div className="decision-badge"><Target size={15} /> Decision</div>
                <h3>{observation.decision}</h3>
                <p>{observation.sceneSummary}</p>
              </div>
              <div className="triage-list">
                {(observation.items ?? []).map((item) => (
                  <div className="triage-row" key={`${item.label}-${item.status}`}>
                    <span className={`triage-state ${item.status}`} />
                    <div className="triage-label"><strong>{item.label}</strong><span>{item.why}</span></div>
                    <span className={`priority priority-${item.priority}`}>{item.priority}</span>
                  </div>
                ))}
              </div>
              <div className="legend"><span><i className="legend-chosen" /> chosen</span><span><i className="legend-suppressed" /> suppressed</span><span><i className="legend-watch" /> watch</span></div>
            </div>

            <div className={`panel narration-card ${observation.safety ? "is-safety" : ""}`}>
              <div className="panel-topline"><div className="panel-title"><Mic2 size={16} /> AUDIO OUTPUT</div><span className="latency"><Zap size={13} /> {observation.latencyMs} ms</span></div>
              <div className="narration-quote">“{observation.narration}”</div>
              <div className="audio-bottom"><Waveform active={speaking} /><button className="play-button" onClick={() => speak(observation.narration)} aria-label="Play narration"><Play size={17} fill="currentColor" /></button></div>
            </div>
          </div>
        </div>
        <div className="demo-note"><Sparkles size={15} /> <strong>Why this proves agency:</strong> the same kind of scene input can result in different narration because context changes the decision. On stairs, safety interrupts everything else. Frames are sent for transient analysis and are not stored by this demo.</div>
      </section>

      <section id="how" className="dark-section">
        <div className="section-shell">
          <div className="section-heading light-heading">
            <div><div className="section-kicker">THE AGENTIC LOOP</div><h2>It is not “camera → caption.”</h2></div>
            <p>Aura separates perception from decision-making so the system can suppress, prioritize, interrupt and narrate based on context.</p>
          </div>
          <div className="flow-grid">
            {featureCards.map(({ icon: Icon, kicker, title, text }, index) => (
              <div className="flow-card" key={title}>
                <div className="flow-number">{String(index + 1).padStart(2, "0")}</div>
                <div className="flow-icon"><Icon size={21} /></div>
                <div className="section-kicker">{kicker}</div>
                <h3>{title}</h3>
                <p>{text}</p>
                {index < featureCards.length - 1 && <ArrowRight className="flow-arrow" size={18} />}
              </div>
            ))}
          </div>
          <div className="architecture-strip">
            <span>PHONE / WEBCAM</span><ArrowRight size={15} /><span>WEBSOCKET</span><ArrowRight size={15} /><span>FASTAPI</span><ArrowRight size={15} /><span>GEMINI VISION</span><ArrowRight size={15} /><span>TRIAGE</span><ArrowRight size={15} /><span>TTS</span><ArrowRight size={15} /><span>EAR</span>
          </div>
        </div>
      </section>

      <section id="use-cases" className="section-shell usecase-section">
        <div className="section-heading"><div><div className="section-kicker">WHERE AURA HELPS</div><h2>Situational awareness, without the flood.</h2></div><p>The experience is designed around contexts where a sighted companion naturally filters attention: navigation, safety and social awareness.</p></div>
        <div className="usecase-grid">
          {useCases.map(([num, title, text]) => <article className="usecase-card" key={num}><span>{num}</span><h3>{title}</h3><p>{text}</p><ArrowRight size={17} /></article>)}
        </div>
      </section>

      <section className="section-shell impact-section">
        <div className="impact-card"><div className="impact-copy"><div className="section-kicker">THE HUMAN FRAMING</div><h2>A sighted companion does this automatically.</h2><p>They do not narrate every chair, wall and window. They notice the step, the person, the gap and the path — then tell you what matters. Aura is designed to reproduce that filtering behavior with an autonomous agent.</p><div className="impact-tags"><span><Check size={14} /> context first</span><span><Check size={14} /> safety can interrupt</span><span><Check size={14} /> less cognitive load</span></div></div><div className="impact-quote"><div className="quote-orbit" /><AudioLines size={58} strokeWidth={1.1} /><strong>“Not more description.<br />More useful awareness.”</strong></div></div>
      </section>

      <section id="hackathon" className="hackathon-section">
        <div className="section-shell">
          <div className="hackathon-card">
            <div><div className="section-kicker">FAR AWAY 2026 · ROUND 1</div><h2>Made to be judged in five minutes.</h2><p>The operator dashboard is front-and-center because the key demo moment is not that Gemini can see — it is that Aura can choose.</p></div>
            <div className="hackathon-actions"><a className="button light" href={pptUrl} target={pptUrl !== "#" ? "_blank" : undefined} rel="noreferrer"><Layers3 size={16} /> Round 1 PPT</a><a className="button line-light" href={repoUrl} target="_blank" rel="noreferrer"><Github size={16} /> GitHub repo</a></div>
          </div>
          <div className="team-strip">
            <div><span>TEAM OF FIVE</span><strong>Built across product, AI, interface and systems.</strong></div>
            <div className="team-roles"><span>Product</span><span>AI / Gemini</span><span>Frontend</span><span>Backend</span><span>Demo / Design</span></div>
          </div>
          <div className="footer-links"><span>© 2026 Aura project</span><span>Built for FAR AWAY 2026 · Agentic & Autonomous Systems</span></div>
        </div>
      </section>

      <div className="accessibility-bar"><div><Sparkles size={15} /> Aura is a concept prototype for hackathon demonstration.</div><a href="#top"><ChevronDown size={15} className="rotate-180" /> back to top</a></div>
    </main>
  );
}
