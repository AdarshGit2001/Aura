import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { auraSchema, auraSystemPrompt } from "@/lib/aura-prompt";

export const runtime = "nodejs";

function cleanBase64(input: string) {
  const match = input.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
  if (!match) {
    return { mimeType: "image/jpeg", data: input };
  }
  return { mimeType: match[1], data: match[2] };
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  try {
    const body = (await request.json()) as { image?: string; context?: string };
    if (!body.image) {
      return NextResponse.json({ error: "An image is required." }, { status: 400 });
    }

    const image = cleanBase64(body.image);
    const ai = new GoogleGenAI({ apiKey });
    const configuredModel = process.env.GEMINI_MODEL || "gemini-3.8-flash";
    const modelsToTry = Array.from(new Set([
      configuredModel,
      "gemini-3.5-flash-lite",
      "gemini-3.1-flash-lite"
    ]));
    const startedAt = Date.now();

    let response: Awaited<ReturnType<typeof ai.models.generateContent>> | null = null;
    let lastError: unknown = null;

    for (const candidate of modelsToTry) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          response = await ai.models.generateContent({
            model: candidate,
            contents: [
              {
                role: "user",
                parts: [
                  { text: `${auraSystemPrompt}\n\nRecent user context: ${body.context || "No prior narration context."}\nAnalyze this camera frame.` },
                  { inlineData: { mimeType: image.mimeType, data: image.data } }
                ]
              }
            ],
            config: {
              responseMimeType: "application/json",
              responseSchema: auraSchema
            }
          });
          break;
        } catch (error) {
          lastError = error;
          const message = error instanceof Error ? error.message : String(error);
          const retryable = /503|UNAVAILABLE|high demand|temporarily/i.test(message);
          if (!retryable || attempt === 1) break;
          await new Promise((resolve) => setTimeout(resolve, 700));
        }
      }
      if (response) break;
    }

    if (!response) {
      throw lastError instanceof Error
        ? lastError
        : new Error("Gemini is temporarily unavailable. Please retry in a few seconds.");
    }

    const raw = (response.text || "{}").trim();
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start < 0 || end <= start) {
        throw new Error("Gemini returned an invalid observation format.");
      }
      parsed = JSON.parse(cleaned.slice(start, end + 1));
    }

    const value = parsed as Partial<import("@/lib/demo-scenes").AuraObservation>;
    if (
      typeof value.sceneSummary !== "string" ||
      typeof value.narration !== "string" ||
      typeof value.safety !== "boolean" ||
      typeof value.urgency !== "string" ||
      typeof value.decision !== "string" ||
      !Array.isArray(value.items)
    ) {
      throw new Error("Gemini returned an incomplete Aura observation.");
    }

    const latencyMs = Date.now() - startedAt;
    return NextResponse.json({ ...value, latencyMs });
  } catch (error) {
    console.error("Aura observation failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gemini observation failed." },
      { status: 500 }
    );
  }
}
