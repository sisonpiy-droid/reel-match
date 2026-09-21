import { requireEnv, upstreamTimeoutMs } from "./env.js";

// Named claude.js because that's the intended provider (per the product
// spec), but it also speaks Gemini -- same pattern as
// presence-project/lib/chat-core.js's pickProvider(): set one provider's
// key, or set LLM_PROVIDER if both happen to be set. This file's job is
// narrow and qualitative on purpose: turn two moods and two free-text
// descriptions into genre/keyword steering for TMDB. The hard constraints
// (language, era, minimum rating, movies-vs-series) are already resolved
// deterministically in lib/preferences.js before this is called -- asking a
// model to also get "max(7, 6) = 7" right every time is a risk with no
// upside.
const BRIEF_SCHEMA = {
  type: "object",
  properties: {
    genres: {
      type: "array",
      items: { type: "string" },
      description: "TMDB genre names to lean into, e.g. \"Comedy\", \"Thriller\".",
    },
    exclude_genres: {
      type: "array",
      items: { type: "string" },
      description: "Genre names clearly at odds with the mood, e.g. exclude \"Horror\" for a romantic mood.",
    },
    search_phrases: {
      type: "array",
      items: { type: "string" },
      description: "2-5 short phrases (2-4 words) capturing free-text mood nuance, used as text search queries -- e.g. \"slow burn heist\", \"cozy comfort watch\".",
    },
    sort_by: {
      type: "string",
      enum: ["popularity.desc", "vote_average.desc", "vote_count.desc"],
    },
    reasoning: {
      type: "string",
      description: "One sentence on how you reconciled the two moods. Not shown to users.",
    },
  },
  required: ["genres", "search_phrases", "sort_by", "reasoning"],
};

const TOOL_NAME = "emit_search_brief";
const TOOL_DESCRIPTION = "Structured TMDB discovery brief for tonight's watch.";

function pickProvider() {
  const forced = (process.env.LLM_PROVIDER || "").toLowerCase();
  if (forced === "gemini" && process.env.GEMINI_API_KEY) return "gemini";
  if (forced === "anthropic" && process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return null;
}

async function callAnthropic(system, userText) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal: AbortSignal.timeout(upstreamTimeoutMs()),
    headers: {
      "content-type": "application/json",
      "x-api-key": requireEnv("ANTHROPIC_API_KEY"),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: userText }],
      tools: [{ name: TOOL_NAME, description: TOOL_DESCRIPTION, input_schema: BRIEF_SCHEMA }],
      tool_choice: { type: "tool", name: TOOL_NAME },
    }),
  });

  const data = await r.json();
  if (!r.ok) throw new Error(`Claude ${r.status}: ${data?.error?.message || "no detail given"}`);

  const toolUse = data.content?.find((b) => b.type === "tool_use" && b.name === TOOL_NAME);
  if (!toolUse) throw new Error("Claude did not return the expected tool call");
  return toolUse.input;
}

// Gemini's function-declaration schema is the same shape as JSON Schema but
// wants its `type` values uppercased (STRING/OBJECT/ARRAY/...) -- everything
// else (properties, items, enum, description, required) carries over as-is.
function toGeminiSchema(schema) {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (schema && typeof schema === "object") {
    const out = {};
    for (const [k, v] of Object.entries(schema)) {
      out[k] = k === "type" && typeof v === "string" ? v.toUpperCase() : toGeminiSchema(v);
    }
    return out;
  }
  return schema;
}

async function callGemini(system, userText) {
  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const r = await fetch(url, {
    method: "POST",
    signal: AbortSignal.timeout(upstreamTimeoutMs()),
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": requireEnv("GEMINI_API_KEY"),
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: userText }] }],
      tools: [{ functionDeclarations: [{ name: TOOL_NAME, description: TOOL_DESCRIPTION, parameters: toGeminiSchema(BRIEF_SCHEMA) }] }],
      toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: [TOOL_NAME] } },
    }),
  });

  const data = await r.json();
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${data?.error?.message || "no detail given"}`);

  const call = data.candidates?.[0]?.content?.parts?.find((p) => p.functionCall?.name === TOOL_NAME)?.functionCall;
  if (!call) {
    const reason = data.candidates?.[0]?.finishReason || "unknown";
    throw new Error(`Gemini did not return the expected function call (finishReason: ${reason})`);
  }
  return call.args;
}

/* combined: output of lib/preferences.js combinePreferences()
   context:
     mode: "initial" | "refine"
     round1: only for "refine" -- { likedByBoth: [...titles], likedByEither: [...titles] }
     coupleHistory: optional -- { loved: [...titles], disliked: [...titles] } from past sessions */
export async function getSearchBrief(combined, context = {}) {
  const provider = pickProvider();
  if (!provider) throw new Error("Set ANTHROPIC_API_KEY or GEMINI_API_KEY");

  const system = [
    "You help pick a movie or show two partners will BOTH enjoy tonight.",
    "You only decide genre/keyword steering -- language, year range, minimum",
    "rating and movies-vs-series are already fixed by the app; do not repeat",
    "them in your reasoning as if they were your call.",
    `Call ${TOOL_NAME} exactly once with your best synthesis.`,
  ].join(" ");

  const lines = [
    `Partner A mood tags: ${combined.moods.join(", ") || "none"}`,
    `Partner A, in their own words: "${combined.moodTextA || "(nothing written)"}"`,
    `Partner B, in their own words: "${combined.moodTextB || "(nothing written)"}"`,
  ];

  if (context.mode === "refine" && context.round1) {
    lines.push(
      "",
      "Round 1 produced no match. Here is what each partner swiped right on --",
      "lean into the pattern, don't just repeat the same titles:",
      `Titles both liked: ${context.round1.likedByBoth.join(", ") || "none"}`,
      `Titles at least one liked: ${context.round1.likedByEither.join(", ") || "none"}`
    );
  }

  if (context.coupleHistory?.loved?.length) {
    lines.push("", `This couple has previously loved: ${context.coupleHistory.loved.join(", ")}`);
  }
  if (context.coupleHistory?.disliked?.length) {
    lines.push(`This couple has previously disliked: ${context.coupleHistory.disliked.join(", ")}`);
  }

  const userText = lines.join("\n");
  return provider === "gemini" ? callGemini(system, userText) : callAnthropic(system, userText);
}
