import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { NextResponse } from "next/server";

import {
  appSpecSchema,
  generateRequestSchema,
  webArtifactSchema,
} from "@/lib/generator-schema";
import { generateMockSpec, renderArtifactFromSpec } from "@/lib/mock-generator";
import type { AppSpec, WebArtifact } from "@/lib/types";

const SECTION_KINDS = [
  "hero",
  "features",
  "stats",
  "testimonial",
  "cta",
] as const;

type BuildMode = "landing" | "dashboard";

function inferBuildMode(prompt: string, existingSpec?: AppSpec | null): BuildMode {
  const content = [
    prompt,
    existingSpec?.projectTitle ?? "",
    existingSpec?.summary ?? "",
    ...(existingSpec?.builderNotes ?? []),
  ]
    .join(" ")
    .toLowerCase();

  if (
    content.includes("dashboard") ||
    content.includes("大盘") ||
    content.includes("看板") ||
    content.includes("数据") ||
    content.includes("sales ops") ||
    content.includes("pipeline") ||
    content.includes("revenue")
  ) {
    return "dashboard";
  }

  return "landing";
}

function buildInstructions(existingSpecPresent: boolean, buildMode: BuildMode) {
  return [
    "You are helping build an Atoms-like AI app builder demo.",
    "Return a compact but polished page specification for a single-page web app preview.",
    "Focus on product clarity, visible agent collaboration, and demo-ready polish.",
    "Prefer confident, specific language over generic marketing filler.",
    "Keep all fields filled, even if some values are short.",
    buildMode === "dashboard"
      ? "The user wants a dashboard-like web app. Prefer KPI cards, charts, tables, filters, and operational insights over landing-page marketing copy."
      : "The user wants a product-facing page. Prefer clear messaging, product framing, and conversion-oriented sections.",
    buildMode === "dashboard"
      ? 'Make the agent reasoning feel like Team Lead -> Data Analyst -> Product Designer -> Engineer. The output should read like an internal product dashboard, not a marketing homepage.'
      : 'Make the agent reasoning feel like Team Lead -> Planner -> Product Designer -> Engineer.',
    existingSpecPresent
      ? "This is a refinement request. Preserve the original direction where possible while improving the latest version."
      : "This is a fresh generation request. Produce a strong first version.",
  ].join(" ");
}

function buildUserPrompt(
  prompt: string,
  buildMode: BuildMode,
  existingSpec?: AppSpec | null,
) {
  return [
    `User request: ${prompt}`,
    `Build mode: ${buildMode}`,
    existingSpec == null
      ? "No previous version exists."
      : `Previous version JSON: ${JSON.stringify(existingSpec)}`,
    "Return only the structured app specification.",
  ].join("\n\n");
}

function buildBuilderPrompt({
  prompt,
  buildMode,
  spec,
  existingArtifact,
}: {
  prompt: string;
  buildMode: BuildMode;
  spec: AppSpec;
  existingArtifact?: WebArtifact | null;
}) {
  return [
    `User request: ${prompt}`,
    `Build mode: ${buildMode}`,
    `Structured plan JSON: ${JSON.stringify(spec)}`,
    existingArtifact == null
      ? "No previous webpage version exists."
      : [
          "Previous webpage artifact:",
          `HTML: ${existingArtifact.html}`,
          `CSS: ${existingArtifact.css}`,
          `JS: ${existingArtifact.js}`,
        ].join("\n"),
    "Generate a single-file webpage with inline CSS and optional inline JavaScript.",
    "Return valid JSON only with keys html, css, js, document.",
    "The document must be a complete HTML document that can be rendered directly in an iframe srcDoc.",
    "Do not use external CDNs, external scripts, or network requests.",
    buildMode === "dashboard"
      ? "For dashboard mode, create an app-like analytics layout with a top bar, filters, KPI cards, 2-3 visualization panels, and at least one table or pipeline list. Use data placeholders, not lorem marketing blocks."
      : "For landing mode, create a polished product page with a strong hero, supporting sections, and clear calls to action.",
  ].join("\n\n");
}

function buildSchemaContract() {
  return [
    "Required JSON shape:",
    "{",
    '  "projectTitle": "string",',
    '  "summary": "string",',
    '  "theme": { "name": "string", "primary": "string", "accent": "string", "surface": "string", "background": "string", "text": "string" },',
    '  "agentLogs": [{ "agent": "string", "focus": "string", "decision": "string" }],',
    '  "sections": [{ "kind": "hero|features|stats|testimonial|cta", "eyebrow": "string", "title": "string", "description": "string", "bullets": ["string"], "metricLabel": "string", "metricValue": "string", "quote": "string", "ctaLabel": "string", "ctaHint": "string" }],',
    '  "builderNotes": ["string"],',
    '  "suggestedFollowUpPrompts": ["string"]',
    "}",
    "There must be exactly 5 sections with kinds hero, features, stats, testimonial, cta.",
    "Every section must include all fields even if some values are empty strings or empty arrays.",
  ].join("\n");
}

function pickString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function pickStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const normalized = value.filter((item): item is string => typeof item === "string");
  return normalized.length > 0 ? normalized : fallback;
}

function extractMessageText(content: unknown) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (
          item != null &&
          typeof item === "object" &&
          "type" in item &&
          "text" in item &&
          (item as { type?: unknown }).type === "text"
        ) {
          return String((item as { text?: unknown }).text ?? "");
        }

        return "";
      })
      .join("")
      .trim();
  }

  return "";
}

function extractJsonPayload(content: string) {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const unfenced = fenced?.[1]?.trim() ?? trimmed;

  const objectStart = unfenced.indexOf("{");
  const objectEnd = unfenced.lastIndexOf("}");

  if (objectStart !== -1 && objectEnd !== -1 && objectEnd > objectStart) {
    return unfenced.slice(objectStart, objectEnd + 1);
  }

  return unfenced;
}

function parseJsonResponse(content: string) {
  return JSON.parse(extractJsonPayload(content));
}

function normalizeAppSpec(candidate: unknown, fallback: AppSpec): AppSpec {
  if (candidate == null || typeof candidate !== "object") {
    return fallback;
  }

  const source = candidate as Record<string, unknown>;
  const sourceTheme =
    source.theme != null && typeof source.theme === "object"
      ? (source.theme as Record<string, unknown>)
      : {};

  const sourceAgentLogs = Array.isArray(source.agentLogs) ? source.agentLogs : [];
  const sourceSections = Array.isArray(source.sections) ? source.sections : [];

  const normalizedSections = SECTION_KINDS.map((kind, index) => {
    const fallbackSection = fallback.sections[index];
    const sourceSection =
      sourceSections.find(
        (item) =>
          item != null &&
          typeof item === "object" &&
          "kind" in item &&
          (item as { kind?: unknown }).kind === kind,
      ) ??
      sourceSections[index] ??
      {};
    const normalizedSource =
      sourceSection != null && typeof sourceSection === "object"
        ? (sourceSection as Record<string, unknown>)
        : {};

    return {
      kind,
      eyebrow: pickString(normalizedSource.eyebrow, fallbackSection.eyebrow),
      title: pickString(normalizedSource.title, fallbackSection.title),
      description: pickString(
        normalizedSource.description,
        fallbackSection.description,
      ),
      bullets: pickStringArray(normalizedSource.bullets, fallbackSection.bullets),
      metricLabel: pickString(
        normalizedSource.metricLabel,
        fallbackSection.metricLabel,
      ),
      metricValue: pickString(
        normalizedSource.metricValue,
        fallbackSection.metricValue,
      ),
      quote: pickString(normalizedSource.quote, fallbackSection.quote),
      ctaLabel: pickString(normalizedSource.ctaLabel, fallbackSection.ctaLabel),
      ctaHint: pickString(normalizedSource.ctaHint, fallbackSection.ctaHint),
    };
  });

  return {
    projectTitle: pickString(source.projectTitle, fallback.projectTitle),
    summary: pickString(source.summary, fallback.summary),
    theme: {
      name: pickString(sourceTheme.name, fallback.theme.name),
      primary: pickString(sourceTheme.primary, fallback.theme.primary),
      accent: pickString(sourceTheme.accent, fallback.theme.accent),
      surface: pickString(sourceTheme.surface, fallback.theme.surface),
      background: pickString(sourceTheme.background, fallback.theme.background),
      text: pickString(sourceTheme.text, fallback.theme.text),
    },
    agentLogs:
      sourceAgentLogs.length > 0
        ? sourceAgentLogs
            .filter(
              (item): item is Record<string, unknown> =>
                item != null && typeof item === "object",
            )
            .slice(0, 4)
            .map((log, index) => ({
              agent: pickString(log.agent, fallback.agentLogs[index]?.agent ?? "Agent"),
              focus: pickString(log.focus, fallback.agentLogs[index]?.focus ?? "Focus"),
              decision: pickString(
                log.decision,
                fallback.agentLogs[index]?.decision ?? "Decision pending.",
              ),
            }))
        : fallback.agentLogs,
    sections: normalizedSections,
    builderNotes: pickStringArray(source.builderNotes, fallback.builderNotes),
    suggestedFollowUpPrompts: pickStringArray(
      source.suggestedFollowUpPrompts,
      fallback.suggestedFollowUpPrompts,
    ),
  };
}

function normalizeArtifact(candidate: unknown, fallback: WebArtifact): WebArtifact {
  if (candidate == null || typeof candidate !== "object") {
    return fallback;
  }

  const source = candidate as Record<string, unknown>;
  const html = pickString(source.html, fallback.html);
  const css = pickString(source.css, fallback.css);
  const js = typeof source.js === "string" ? source.js : fallback.js;
  const document = pickString(
    source.document,
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Generated build</title>
    <style>${css}</style>
  </head>
  <body>
    ${html}
    <script>${js}</script>
  </body>
</html>`,
  );

  return {
    html,
    css,
    js,
    document,
  };
}

function resolveProvider() {
  const kimiApiKey = process.env.KIMI_API_KEY ?? process.env.Kimi_API_KEY;

  if (kimiApiKey) {
    return {
      provider: "kimi" as const,
      apiKey: kimiApiKey,
      baseURL:
        process.env.KIMI_BASE_URL ??
        process.env.Kimi_BASE_URL ??
        "https://api.moonshot.cn/v1",
      model:
        process.env.KIMI_MODEL ??
        process.env.Kimi_MODEL ??
        "kimi-k2.5",
    };
  }

  if (process.env.OPENAI_API_KEY) {
    return {
      provider: "openai" as const,
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: undefined,
      model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
    };
  }

  return null;
}

async function generateWithStructuredChat({
  client,
  model,
  prompt,
  buildMode,
  existingSpec,
}: {
  client: OpenAI;
  model: string;
  prompt: string;
  buildMode: BuildMode;
  existingSpec?: AppSpec | null;
}) {
  const completion = await client.chat.completions.parse({
    model,
    messages: [
      {
        role: "system",
        content: buildInstructions(existingSpec != null, buildMode),
      },
      {
        role: "user",
        content: buildUserPrompt(prompt, buildMode, existingSpec),
      },
    ],
    response_format: zodResponseFormat(appSpecSchema, "atoms_studio_spec"),
  });

  return completion.choices[0]?.message.parsed ?? null;
}

async function generateWithPlainJson({
  client,
  provider,
  model,
  prompt,
  buildMode,
  existingSpec,
  fallback,
}: {
  client: OpenAI;
  provider: "kimi" | "openai";
  model: string;
  prompt: string;
  buildMode: BuildMode;
  existingSpec?: AppSpec | null;
  fallback: AppSpec;
}) {
  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: [
          buildInstructions(existingSpec != null, buildMode),
          "Output valid JSON only.",
          "Do not wrap the JSON in markdown code fences.",
          "Ensure every field in the target schema is present.",
          buildSchemaContract(),
        ].join(" "),
      },
      {
        role: "user",
        content: buildUserPrompt(prompt, buildMode, existingSpec),
      },
    ],
    ...(provider === "openai" ? { temperature: 0.7 } : {}),
  });

  const content = completion.choices[0]?.message.content;

  if (!content) {
    return null;
  }

  const parsedContent = parseJsonResponse(extractMessageText(content));
  const normalized = normalizeAppSpec(parsedContent, fallback);

  try {
    return appSpecSchema.parse(normalized);
  } catch (error) {
    const repair = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: [
            "You repair JSON objects so they exactly match a required schema.",
            "Output valid JSON only.",
            "Do not explain anything.",
            buildSchemaContract(),
          ].join(" "),
        },
        {
          role: "user",
          content: [
            "Fix this JSON so it matches the required shape exactly.",
            `Validation errors: ${
              error instanceof Error ? error.message : JSON.stringify(error)
            }`,
            `JSON to repair: ${JSON.stringify(parsedContent)}`,
          ].join("\n\n"),
        },
      ],
      ...(provider === "openai" ? { temperature: 0.2 } : {}),
    });

    const repairedContent = repair.choices[0]?.message.content;

    if (!repairedContent) {
      return normalized;
    }

    return appSpecSchema.parse(
      normalizeAppSpec(
        parseJsonResponse(extractMessageText(repairedContent)),
        fallback,
      ),
    );
  }
}

async function generateArtifactWithPlainJson({
  client,
  provider,
  model,
  prompt,
  buildMode,
  spec,
  existingArtifact,
  fallback,
}: {
  client: OpenAI;
  provider: "kimi" | "openai";
  model: string;
  prompt: string;
  buildMode: BuildMode;
  spec: AppSpec;
  existingArtifact?: WebArtifact | null;
  fallback: WebArtifact;
}) {
  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: [
          "You are the Builder agent in an agent loop.",
          "Turn the approved product plan into a polished webpage.",
          buildMode === "dashboard"
            ? "You are building a dashboard web app for operational review. Prioritize dense but readable information design."
            : "You are building a polished product webpage. Prioritize narrative clarity and conversion polish.",
          "Return valid JSON only.",
          "Do not wrap JSON in markdown fences.",
          'Use exactly these keys: "html", "css", "js", "document".',
          "The document must be a full standalone HTML document.",
          "Keep the output production-like but compact.",
        ].join(" "),
      },
      {
        role: "user",
        content: buildBuilderPrompt({
          prompt,
          buildMode,
          spec,
          existingArtifact,
        }),
      },
    ],
    ...(provider === "openai" ? { temperature: 0.7 } : {}),
  });

  const content = completion.choices[0]?.message.content;

  if (!content) {
    return fallback;
  }

  const parsedContent = parseJsonResponse(extractMessageText(content));
  const normalized = normalizeArtifact(parsedContent, fallback);

  try {
    return webArtifactSchema.parse(normalized);
  } catch {
    return normalized;
  }
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const payload = generateRequestSchema.parse(json);
    const fallback = generateMockSpec(payload.prompt, payload.existingSpec);
    const fallbackArtifact = renderArtifactFromSpec(fallback);
    const provider = resolveProvider();
    const buildMode = inferBuildMode(payload.prompt, payload.existingSpec);

    if (!provider) {
      return NextResponse.json({
        source: "mock" as const,
        spec: fallback,
        artifact: fallbackArtifact,
      });
    }

    const client = new OpenAI({
      apiKey: provider.apiKey,
      baseURL: provider.baseURL,
    });

    let parsed: AppSpec | null = null;
    let artifact: WebArtifact | null = null;
    let source: "mock" | "openai" | "kimi" = provider.provider;

    if (provider.provider === "openai") {
      try {
        parsed = await generateWithStructuredChat({
          client,
          model: provider.model,
          prompt: payload.prompt,
          buildMode,
          existingSpec: payload.existingSpec,
        });
      } catch (error) {
        console.warn("Structured generation failed, falling back to plain JSON", {
          provider: provider.provider,
          model: provider.model,
          error,
        });
      }
    }

    if (parsed == null) {
      try {
        parsed = await generateWithPlainJson({
          client,
          provider: provider.provider,
          model: provider.model,
          prompt: payload.prompt,
          buildMode,
          existingSpec: payload.existingSpec,
          fallback,
        });
      } catch (error) {
        console.warn("Plain JSON generation failed, falling back to mock", {
          provider: provider.provider,
          model: provider.model,
          error,
        });
      }
    }

    if (parsed == null) {
      parsed = fallback;
      source = "mock";
    }

    try {
      artifact = await generateArtifactWithPlainJson({
        client,
        provider: provider.provider,
        model: provider.model,
        prompt: payload.prompt,
        buildMode,
        spec: parsed,
        existingArtifact: payload.existingArtifact,
        fallback: renderArtifactFromSpec(parsed),
      });
    } catch (error) {
      console.warn("Artifact generation failed, falling back to mock artifact", {
        provider: provider.provider,
        model: provider.model,
        error,
      });
      artifact = renderArtifactFromSpec(parsed);
      source = "mock";
    }

    return NextResponse.json({
      source,
      spec: parsed,
      artifact,
    });
  } catch (error) {
    console.error("Failed to generate spec", error);

    return NextResponse.json(
      {
        message: "Unable to generate a build right now.",
      },
      { status: 500 },
    );
  }
}
