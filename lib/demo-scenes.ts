export type SceneKind = "calm" | "stairs" | "crowd";

export type TriageItem = {
  label: string;
  status: "chosen" | "suppressed" | "watch";
  priority: "critical" | "high" | "medium" | "low";
  why: string;
};

export type AuraObservation = {
  sceneSummary: string;
  narration: string;
  safety: boolean;
  urgency: "critical" | "high" | "normal";
  decision: string;
  items: TriageItem[];
  latencyMs: number;
};

export const demoScenes: Record<SceneKind, AuraObservation> = {
  calm: {
    sceneSummary: "A calm indoor room with a clear walking path and one person nearby.",
    narration: "The path ahead is clear. Someone is standing a few steps to your right.",
    safety: false,
    urgency: "normal",
    decision: "Surface the path and person; suppress static furniture.",
    latencyMs: 820,
    items: [
      { label: "person", status: "chosen", priority: "medium", why: "Relevant social context." },
      { label: "clear path", status: "chosen", priority: "medium", why: "Helps with navigation." },
      { label: "chair", status: "suppressed", priority: "low", why: "Static clutter; not decision-relevant." },
      { label: "table", status: "suppressed", priority: "low", why: "Static clutter; low immediate value." },
      { label: "wall", status: "suppressed", priority: "low", why: "No action required." }
    ]
  },
  stairs: {
    sceneSummary: "A corridor ends in a downward step with a clear safety consequence.",
    narration: "Safety alert: a step down is about one meter ahead. Slow down.",
    safety: true,
    urgency: "critical",
    decision: "Interrupt current context and prioritize the step.",
    latencyMs: 910,
    items: [
      { label: "step down", status: "chosen", priority: "critical", why: "Immediate fall risk; interrupts narration." },
      { label: "handrail", status: "watch", priority: "high", why: "Useful support near the hazard." },
      { label: "door", status: "suppressed", priority: "low", why: "Less urgent than the step." },
      { label: "poster", status: "suppressed", priority: "low", why: "Irrelevant during a safety event." },
      { label: "wall", status: "suppressed", priority: "low", why: "No action required." }
    ]
  },
  crowd: {
    sceneSummary: "A busy walkway with several moving people crossing the user's path.",
    narration: "Several people are moving across your path. Keep slightly to your left and move slowly.",
    safety: true,
    urgency: "high",
    decision: "Track motion that can cause a collision; suppress static surroundings.",
    latencyMs: 980,
    items: [
      { label: "moving people", status: "chosen", priority: "high", why: "Collision paths are changing." },
      { label: "person crossing left-to-right", status: "chosen", priority: "high", why: "Directly intersects path." },
      { label: "signage", status: "suppressed", priority: "low", why: "Not actionable in the moment." },
      { label: "bench", status: "suppressed", priority: "low", why: "Static object outside path." },
      { label: "window", status: "suppressed", priority: "low", why: "No immediate relevance." }
    ]
  }
};
