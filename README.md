# Aura — Hackathon Website / Live Demo

Aura is an agentic sensory narrator for blind and low-vision users. This project is built from the supplied Round 1 PRD and is designed to make the core product behavior visible to judges: **perceive → triage → narrate**.

## Included

- Premium single-page public website for the project story.
- Live demo workspace with camera capture.
- Gemini multimodal scene analysis through a server-side Next.js API route.
- Structured agent output: scene summary, narration, safety level, decision, chosen/suppressed/watch items.
- Browser speech synthesis for immediate narration during the demo.
- Scripted fallback scenes for a reliable stage demo.
- “Round 1 PPT” and “GitHub repo” links driven by environment variables.
- Responsive layout for desktop and tablet.

## Run locally

1. Install Node.js 20+.
2. Copy `.env.example` to `.env.local`.
3. Add your Gemini API key to `GEMINI_API_KEY`.
4. Optionally update `NEXT_PUBLIC_REPO_URL` and `NEXT_PUBLIC_PPT_URL`.
5. Install dependencies: `npm install`
6. Start: `npm run dev`
7. Open `http://localhost:3000`

## Gemini integration

The Gemini key is intentionally **not** hard-coded into the repo. The API route runs on the server, so the secret is not sent to the browser. The default model is `gemini-3.8-flash`; change `GEMINI_MODEL` in `.env.local` when needed.

The camera demo converts one selected frame to a JPEG data URL, posts it to `/api/aura/observe`, and Gemini returns structured JSON for the operator dashboard. The browser then reads the returned narration with SpeechSynthesis.

## Demo flow for judges

1. Open the landing page and click **Enter the experience**.
2. Start with **Calm room**. Point out that furniture is suppressed while the path/person are chosen.
3. Click **Step hazard**. Point out that the system switches into a safety interrupt and produces a directional warning.
4. Click **Crowded space** to show motion priority.
5. For live Gemini proof, allow camera access and click **Use camera → Analyze frame**. The real model output replaces the scripted observation.

## Project note

This is a Round 1 hackathon prototype. The PRD explicitly treats custom wearable hardware, offline/on-device inference, multi-language narration, and advanced emotion/social-cue reading as out of scope for the core demo.
