import OpenAI from "openai";

import { appSpecSchema, generateRequestSchema } from "@/lib/generator-schema";
import { generateMockSpec, renderArtifactFromSpec } from "@/lib/mock-generator";
import type {
  AgentLog,
  AppSpec,
  BuildMode,
  LoopEvent,
  LoopSnapshot,
  LoopTodo,
  ThemeSpec,
  WebArtifact,
} from "@/lib/types";

export const runtime = "nodejs";

type Provider = {
  provider: "kimi" | "openai";
  apiKey: string;
  baseURL?: string;
  model: string;
};

type LoopState = {
  prompt: string;
  fallback: AppSpec;
  buildMode: BuildMode | null;
  currentAgent: string;
  currentPhase: string;
  todos: LoopTodo[];
  audience: string;
  successSignal: string;
  pageGoal: string;
  visualDirection: string;
  sectionTitles: string[];
  dashboardKpis: string[];
  filters: string[];
  widgets: string[];
  builderNotes: string[];
  followUps: string[];
  agentLogs: AgentLog[];
  spec: AppSpec | null;
  artifact: WebArtifact | null;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function now() {
  return new Date().toISOString();
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
    } satisfies Provider;
  }

  if (process.env.OPENAI_API_KEY) {
    return {
      provider: "openai" as const,
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
    } satisfies Provider;
  }

  return null;
}

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
    content.includes("pipeline") ||
    content.includes("sales") ||
    content.includes("revenue")
  ) {
    return "dashboard";
  }

  return "landing";
}

function buildSystemPrompt(buildMode: BuildMode, hasExistingSpec: boolean) {
  return [
    "You are the orchestration brain for an Atoms-like AI product builder.",
    "You must operate through tools, iteratively, until the build is complete.",
    "Do not stop after a minimal loop. Run a full planning and build loop.",
    "You must maintain todos, capture agent decisions, define the information architecture, finalize the spec, build the artifact, and only then provide a short handoff.",
    "There must be exactly one todo in_progress at a time.",
    "Use compact, specific language. Avoid generic filler.",
    "The visible agent roles should feel like Team Lead, Data Analyst or Planner, Product Designer, and Engineer.",
    buildMode === "dashboard"
      ? "This request is dashboard mode. Prioritize KPI cards, charts, filters, tables, pipeline visibility, and operational insight."
      : "This request is landing mode. Prioritize a sharp hero, supporting sections, and conversion-oriented product framing.",
    hasExistingSpec
      ? "This is a refinement pass. Preserve the core direction unless the user explicitly asks to replace it."
      : "This is a fresh generation. Establish a strong first direction.",
    "Start by writing a concrete todo list with 5-7 steps. Then execute the loop with tools.",
    "You should call log_agent_decision several times during the loop so the UI can show visible agent collaboration.",
    "Before finalizing, make sure the build is demo-ready.",
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
    "Operate through the tools and finish with a concise handoff once the artifact is built.",
  ].join("\n\n");
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

function normalizeSpec(candidate: unknown, fallback: AppSpec): AppSpec {
  if (candidate == null || typeof candidate !== "object") {
    return fallback;
  }

  const source = candidate as Record<string, unknown>;
  const sourceTheme =
    source.theme != null && typeof source.theme === "object"
      ? (source.theme as Record<string, unknown>)
      : {};
  const sourceSections = Array.isArray(source.sections) ? source.sections : [];
  const sourceAgentLogs = Array.isArray(source.agentLogs) ? source.agentLogs : [];

  return appSpecSchema.parse({
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
            .slice(0, 8)
            .map((log, index) => ({
              agent: pickString(log.agent, fallback.agentLogs[index]?.agent ?? "Agent"),
              focus: pickString(log.focus, fallback.agentLogs[index]?.focus ?? "Focus"),
              decision: pickString(
                log.decision,
                fallback.agentLogs[index]?.decision ?? "Decision pending.",
              ),
            }))
        : fallback.agentLogs,
    sections: fallback.sections.map((fallbackSection, index) => {
      const sourceSection =
        sourceSections[index] != null && typeof sourceSections[index] === "object"
          ? (sourceSections[index] as Record<string, unknown>)
          : {};

      return {
        kind: fallbackSection.kind,
        eyebrow: pickString(sourceSection.eyebrow, fallbackSection.eyebrow),
        title: pickString(sourceSection.title, fallbackSection.title),
        description: pickString(
          sourceSection.description,
          fallbackSection.description,
        ),
        bullets: pickStringArray(sourceSection.bullets, fallbackSection.bullets),
        metricLabel: pickString(
          sourceSection.metricLabel,
          fallbackSection.metricLabel,
        ),
        metricValue: pickString(
          sourceSection.metricValue,
          fallbackSection.metricValue,
        ),
        quote: pickString(sourceSection.quote, fallbackSection.quote),
        ctaLabel: pickString(sourceSection.ctaLabel, fallbackSection.ctaLabel),
        ctaHint: pickString(sourceSection.ctaHint, fallbackSection.ctaHint),
      };
    }),
    builderNotes: pickStringArray(source.builderNotes, fallback.builderNotes),
    suggestedFollowUpPrompts: pickStringArray(
      source.suggestedFollowUpPrompts,
      fallback.suggestedFollowUpPrompts,
    ),
  });
}

function snapshotFromState(state: LoopState): LoopSnapshot {
  return {
    buildMode: state.buildMode,
    currentAgent: state.currentAgent,
    currentPhase: state.currentPhase,
    todos: state.todos,
    audience: state.audience,
    successSignal: state.successSignal,
    pageGoal: state.pageGoal,
    visualDirection: state.visualDirection,
    sections: state.sectionTitles,
    dashboardKpis: state.dashboardKpis,
    filters: state.filters,
    widgets: state.widgets,
    builderNotes: state.builderNotes,
  };
}

function toolSchema() {
  return [
    {
      type: "function" as const,
      function: {
        name: "todo_write",
        description:
          "Create or update the current todo list. Keep 5-7 concrete steps and exactly one in_progress item.",
        parameters: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  content: { type: "string" },
                  status: {
                    type: "string",
                    enum: ["pending", "in_progress", "completed"],
                  },
                  owner: { type: "string" },
                },
                required: ["content", "status"],
              },
            },
          },
          required: ["items"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "set_build_mode",
        description:
          "Lock the build mode and explain why this mode fits the user request.",
        parameters: {
          type: "object",
          properties: {
            mode: { type: "string", enum: ["landing", "dashboard"] },
            rationale: { type: "string" },
          },
          required: ["mode", "rationale"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "capture_brief",
        description:
          "Capture the audience, page goal, and success signal for the build.",
        parameters: {
          type: "object",
          properties: {
            audience: { type: "string" },
            pageGoal: { type: "string" },
            successSignal: { type: "string" },
          },
          required: ["audience", "pageGoal", "successSignal"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "define_dashboard_schema",
        description:
          "For dashboard builds, define KPIs, filters, widgets, and operational focus.",
        parameters: {
          type: "object",
          properties: {
            kpis: { type: "array", items: { type: "string" } },
            filters: { type: "array", items: { type: "string" } },
            widgets: { type: "array", items: { type: "string" } },
            note: { type: "string" },
          },
          required: ["kpis", "filters", "widgets", "note"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "define_information_architecture",
        description:
          "Define the project title, summary, visual direction, major sections, builder notes, and follow-up prompts.",
        parameters: {
          type: "object",
          properties: {
            projectTitle: { type: "string" },
            summary: { type: "string" },
            visualDirection: { type: "string" },
            sections: { type: "array", items: { type: "string" } },
            builderNotes: { type: "array", items: { type: "string" } },
            suggestedFollowUpPrompts: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: [
            "projectTitle",
            "summary",
            "visualDirection",
            "sections",
            "builderNotes",
            "suggestedFollowUpPrompts",
          ],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "log_agent_decision",
        description:
          "Emit a visible agent decision that will appear in the UI timeline.",
        parameters: {
          type: "object",
          properties: {
            agent: { type: "string" },
            focus: { type: "string" },
            decision: { type: "string" },
          },
          required: ["agent", "focus", "decision"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "finalize_spec",
        description:
          "Create the final structured app spec. Use all required fields and keep the five-section layout.",
        parameters: {
          type: "object",
          properties: {
            projectTitle: { type: "string" },
            summary: { type: "string" },
            theme: {
              type: "object",
              properties: {
                name: { type: "string" },
                primary: { type: "string" },
                accent: { type: "string" },
                surface: { type: "string" },
                background: { type: "string" },
                text: { type: "string" },
              },
              required: [
                "name",
                "primary",
                "accent",
                "surface",
                "background",
                "text",
              ],
            },
            sections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  eyebrow: { type: "string" },
                  title: { type: "string" },
                  description: { type: "string" },
                  bullets: { type: "array", items: { type: "string" } },
                  metricLabel: { type: "string" },
                  metricValue: { type: "string" },
                  quote: { type: "string" },
                  ctaLabel: { type: "string" },
                  ctaHint: { type: "string" },
                },
                required: [
                  "eyebrow",
                  "title",
                  "description",
                  "bullets",
                  "metricLabel",
                  "metricValue",
                  "quote",
                  "ctaLabel",
                  "ctaHint",
                ],
              },
            },
            builderNotes: { type: "array", items: { type: "string" } },
            suggestedFollowUpPrompts: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: [
            "projectTitle",
            "summary",
            "theme",
            "sections",
            "builderNotes",
            "suggestedFollowUpPrompts",
          ],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "build_artifact",
        description:
          "Build the final HTML/CSS/JS artifact from the finalized spec. Call this only after finalize_spec.",
        parameters: {
          type: "object",
          properties: {
            rationale: { type: "string" },
          },
          required: ["rationale"],
        },
      },
    },
  ];
}

function parseArgs(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
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
      .join("");
  }

  return "";
}

function extractReasoningContent(message: unknown) {
  if (
    message != null &&
    typeof message === "object" &&
    "reasoning_content" in message
  ) {
    const value = (message as { reasoning_content?: unknown }).reasoning_content;
    return typeof value === "string" && value.trim() ? value : "";
  }

  return "";
}

function buildSpecFromToolArgs(
  args: Record<string, unknown>,
  state: LoopState,
): AppSpec {
  const fallback = state.fallback;
  const theme =
    args.theme != null && typeof args.theme === "object"
      ? (args.theme as ThemeSpec)
      : fallback.theme;
  const sections = Array.isArray(args.sections) ? args.sections : [];

  return normalizeSpec(
    {
      projectTitle: pickString(args.projectTitle, fallback.projectTitle),
      summary: pickString(args.summary, fallback.summary),
      theme,
      sections,
      agentLogs:
        state.agentLogs.length > 0 ? state.agentLogs : fallback.agentLogs,
      builderNotes: [
        ...fallback.builderNotes,
        ...state.builderNotes,
        ...pickStringArray(args.builderNotes, []),
      ].slice(0, 8),
      suggestedFollowUpPrompts:
        pickStringArray(args.suggestedFollowUpPrompts, state.followUps).length > 0
          ? pickStringArray(args.suggestedFollowUpPrompts, state.followUps)
          : fallback.suggestedFollowUpPrompts,
    },
    fallback,
  );
}

function executeTool(
  name: string,
  args: Record<string, unknown>,
  state: LoopState,
) {
  switch (name) {
    case "todo_write": {
      const items = Array.isArray(args.items) ? args.items : [];
      state.todos = items
        .filter((item): item is Record<string, unknown> => item != null && typeof item === "object")
        .map((item, index) => ({
          id: pickString(item.id, `${index + 1}`),
          content: pickString(item.content, `Step ${index + 1}`),
          status:
            item.status === "completed" ||
            item.status === "in_progress" ||
            item.status === "pending"
              ? item.status
              : "pending",
          owner: typeof item.owner === "string" ? item.owner : undefined,
        }));
      state.currentPhase = "Todo plan updated";
      return {
        ok: true,
        summary: `Tracked ${state.todos.length} todo items for the active loop.`,
      };
    }
    case "set_build_mode": {
      state.buildMode =
        args.mode === "dashboard" || args.mode === "landing"
          ? args.mode
          : state.buildMode;
      state.currentAgent = "Team Lead";
      state.currentPhase = pickString(args.rationale, "Build mode aligned.");
      state.builderNotes = [...state.builderNotes, state.currentPhase].slice(0, 8);
      return {
        ok: true,
        summary: `Build mode locked to ${state.buildMode}.`,
      };
    }
    case "capture_brief": {
      state.audience = pickString(args.audience, state.audience);
      state.pageGoal = pickString(args.pageGoal, state.pageGoal);
      state.successSignal = pickString(args.successSignal, state.successSignal);
      state.currentAgent = state.buildMode === "dashboard" ? "Data Analyst" : "Planner";
      state.currentPhase = "Core brief captured";
      return {
        ok: true,
        summary: `Audience: ${state.audience}; goal: ${state.pageGoal}.`,
      };
    }
    case "define_dashboard_schema": {
      state.currentAgent = "Data Analyst";
      state.currentPhase = "Dashboard schema defined";
      state.dashboardKpis = pickStringArray(args.kpis, state.dashboardKpis);
      state.filters = pickStringArray(args.filters, state.filters);
      state.widgets = pickStringArray(args.widgets, state.widgets);
      const note = pickString(args.note, "");
      if (note) {
        state.builderNotes = [...state.builderNotes, note].slice(0, 8);
      }
      return {
        ok: true,
        summary: `Dashboard schema now tracks ${state.dashboardKpis.length} KPIs and ${state.widgets.length} widgets.`,
      };
    }
    case "define_information_architecture": {
      state.currentAgent = "Product Designer";
      state.currentPhase = "Information architecture drafted";
      state.sectionTitles = pickStringArray(args.sections, state.sectionTitles);
      state.visualDirection = pickString(args.visualDirection, state.visualDirection);
      state.builderNotes = [
        ...state.builderNotes,
        ...pickStringArray(args.builderNotes, []),
      ].slice(0, 8);
      state.followUps = pickStringArray(
        args.suggestedFollowUpPrompts,
        state.followUps,
      );
      return {
        ok: true,
        summary: `Information architecture drafted with ${state.sectionTitles.length} planned sections.`,
      };
    }
    case "log_agent_decision": {
      const log = {
        agent: pickString(args.agent, state.currentAgent || "Agent"),
        focus: pickString(args.focus, "Progress"),
        decision: pickString(args.decision, "Updated the current build direction."),
      };
      state.currentAgent = log.agent;
      state.currentPhase = log.focus;
      state.agentLogs = [...state.agentLogs, log].slice(-8);
      return {
        ok: true,
        summary: `${log.agent} updated the loop: ${log.focus}.`,
      };
    }
    case "finalize_spec": {
      state.currentAgent = "Engineer";
      state.currentPhase = "Structured spec finalized";
      state.spec = buildSpecFromToolArgs(args, state);
      return {
        ok: true,
        summary: `Finalized spec for ${state.spec.projectTitle}.`,
      };
    }
    case "build_artifact": {
      state.currentAgent = "Preview";
      state.currentPhase = "Rendering final artifact";
      if (state.spec == null) {
        state.spec = state.fallback;
      }
      state.artifact = renderArtifactFromSpec(state.spec);
      return {
        ok: true,
        summary: pickString(
          args.rationale,
          "Built the final iframe-ready webpage artifact.",
        ),
      };
    }
    default:
      return {
        ok: false,
        summary: `Unknown tool: ${name}`,
      };
  }
}

function createEvent(
  type: LoopEvent["type"],
  message: string,
  state: LoopState,
  extra?: Partial<LoopEvent>,
) {
  return {
    type,
    message,
    timestamp: now(),
    agent: state.currentAgent,
    phase: state.currentPhase,
    snapshot: snapshotFromState(state),
    ...extra,
  };
}

async function streamMockLoop(
  state: LoopState,
  push: (event: Record<string, unknown>) => void,
) {
  state.todos = [
    { id: "1", content: "Interpret the request and pick a build mode", status: "completed", owner: "Team Lead" },
    { id: "2", content: "Capture audience, goal, and success signal", status: "completed", owner: "Planner" },
    { id: "3", content: "Define dashboard modules and KPIs", status: "completed", owner: "Data Analyst" },
    { id: "4", content: "Finalize the product spec", status: "completed", owner: "Product Designer" },
    { id: "5", content: "Build the iframe-ready webpage", status: "completed", owner: "Engineer" },
  ];
  push(createEvent("status", "No live model configured. Running deterministic local agent loop.", state));
  await sleep(120);
  state.buildMode = inferBuildMode(state.prompt, state.fallback);
  state.currentAgent = "Team Lead";
  state.currentPhase = "Mode selected";
  push(createEvent("tool_result", `Mode set to ${state.buildMode}.`, state));
  await sleep(120);
  state.audience = state.buildMode === "dashboard" ? "sales leaders and revenue operators" : "buyers evaluating the product";
  state.pageGoal = state.buildMode === "dashboard" ? "review the health of the sales pipeline" : "understand and trust the product";
  state.successSignal = state.buildMode === "dashboard" ? "the manager can identify risk and next actions in under a minute" : "the visitor understands the value proposition immediately";
  state.currentAgent = state.buildMode === "dashboard" ? "Data Analyst" : "Planner";
  state.currentPhase = "Brief captured";
  push(createEvent("tool_result", "Captured audience, goal, and success signal.", state));
  await sleep(120);
  state.spec = state.fallback;
  state.agentLogs = state.fallback.agentLogs;
  state.sectionTitles = state.fallback.sections.map((section) => section.title);
  state.builderNotes = state.fallback.builderNotes;
  state.followUps = state.fallback.suggestedFollowUpPrompts;
  state.dashboardKpis =
    state.buildMode === "dashboard"
      ? ["Pipeline value", "Quota attainment", "Win rate", "At-risk deals"]
      : [];
  state.filters =
    state.buildMode === "dashboard" ? ["Quarter", "Region", "Segment"] : [];
  state.widgets =
    state.buildMode === "dashboard"
      ? ["KPI cards", "Trend chart", "Deal table", "Insight panel"]
      : ["Hero", "Feature blocks", "Stats", "CTA"];
  state.currentAgent = "Engineer";
  state.currentPhase = "Spec finalized";
  push(createEvent("tool_result", `Finalized spec for ${state.spec.projectTitle}.`, state));
  await sleep(120);
  state.artifact = renderArtifactFromSpec(state.spec);
  state.currentAgent = "Preview";
  state.currentPhase = "Artifact rendered";
  push(createEvent("tool_result", "Built the iframe-ready artifact.", state));
}

export async function POST(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (event: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
        );
      };

      try {
        const json = await request.json();
        const payload = generateRequestSchema.parse(json);
        const fallback = generateMockSpec(payload.prompt, payload.existingSpec);
        const state: LoopState = {
          prompt: payload.prompt,
          fallback,
          buildMode: inferBuildMode(payload.prompt, payload.existingSpec),
          currentAgent: "Team Lead",
          currentPhase: "Initializing full agent loop",
          todos: [],
          audience: "",
          successSignal: "",
          pageGoal: "",
          visualDirection: "",
          sectionTitles: [],
          dashboardKpis: [],
          filters: [],
          widgets: [],
          builderNotes: [],
          followUps: [],
          agentLogs: [],
          spec: null,
          artifact: null,
        };

        push(createEvent("status", "Agent loop started.", state));

        const provider = resolveProvider();

        if (!provider) {
          await streamMockLoop(state, push);
          push({
            ...createEvent("completed", "Build completed with local fallback loop.", state),
            payload: {
              source: "mock",
              spec: state.spec ?? fallback,
              artifact: state.artifact ?? renderArtifactFromSpec(state.spec ?? fallback),
            },
          });
          controller.close();
          return;
        }

        try {
          const client = new OpenAI({
            apiKey: provider.apiKey,
            baseURL: provider.baseURL,
          });

          const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            {
              role: "system",
              content: buildSystemPrompt(
                state.buildMode ?? "landing",
                payload.existingSpec != null,
              ),
            },
            {
              role: "user",
              content: buildUserPrompt(
                payload.prompt,
                state.buildMode ?? "landing",
                payload.existingSpec,
              ),
            },
          ];

          let finalText = "";

          for (let round = 0; round < 10; round += 1) {
            state.currentPhase = `Model reasoning round ${round + 1}`;
            push(createEvent("status", `Starting model round ${round + 1}.`, state));

            const completion = await client.chat.completions.create({
              model: provider.model,
              messages,
              tools: toolSchema(),
              tool_choice: "auto",
              ...(provider.provider === "openai" ? { temperature: 0.4 } : {}),
            });

            const choice = completion.choices[0];
            const message = choice?.message;

            if (!message) {
              break;
            }

            const textContent = extractMessageText(message.content);
            const reasoningContent = extractReasoningContent(message);

            if (message.tool_calls && message.tool_calls.length > 0) {
              const assistantMessage: OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam & {
                reasoning_content?: string;
              } = {
                role: "assistant",
                content: textContent || "",
                tool_calls: message.tool_calls
                  .filter(
                    (
                      toolCall,
                    ): toolCall is Extract<typeof toolCall, { type: "function" }> =>
                      toolCall.type === "function",
                  )
                  .map((toolCall) => ({
                    id: toolCall.id,
                    type: "function" as const,
                    function: {
                      name: toolCall.function.name,
                      arguments: toolCall.function.arguments,
                    },
                  })),
              };

              if (provider.provider === "kimi") {
                assistantMessage.reasoning_content =
                  reasoningContent || textContent || "Tool planning in progress.";
              }

              messages.push(assistantMessage);

              for (const toolCall of message.tool_calls) {
                if (toolCall.type !== "function") {
                  continue;
                }

                const args = parseArgs(toolCall.function.arguments);

                push(
                  createEvent(
                    "tool_call",
                    `${toolCall.function.name} requested.`,
                    state,
                  ),
                );

                const result = executeTool(toolCall.function.name, args, state);

                push(createEvent("tool_result", result.summary, state));

                messages.push({
                  role: "tool",
                  tool_call_id: toolCall.id,
                  content: JSON.stringify({
                    ok: result.ok,
                    summary: result.summary,
                    snapshot: snapshotFromState(state),
                  }),
                });
              }

              if (state.spec != null && state.artifact != null) {
                finalText =
                  "The build is complete. The spec and artifact are finalized and ready for preview.";
                break;
              }

              continue;
            }

            if (textContent.trim()) {
              finalText = textContent.trim();
              messages.push({
                role: "assistant",
                content: finalText,
              });
              push(createEvent("assistant", finalText, state));
            }

            if (state.spec != null && state.artifact != null) {
              break;
            }
          }

          if (state.spec == null) {
            state.spec = fallback;
          }

          if (state.artifact == null) {
            state.artifact = renderArtifactFromSpec(state.spec);
          }

          if (!finalText) {
            finalText = "The build loop completed and the artifact is ready.";
          }

          state.currentAgent = "Preview";
          state.currentPhase = "Loop completed";

          push(createEvent("assistant", finalText, state));

          push({
            ...createEvent("completed", "Agent loop completed.", state),
            payload: {
              source: provider.provider,
              spec: state.spec,
              artifact: state.artifact,
            },
          });
        } catch (providerError) {
          const providerMessage =
            providerError instanceof Error
              ? providerError.message
              : "Unknown provider failure";

          state.currentAgent = "System";
          state.currentPhase = "Fallback to local loop";
          push(
            createEvent(
              "status",
              `Live provider failed (${provider.provider}). Falling back to local build loop.`,
              state,
            ),
          );
          push(createEvent("tool_result", providerMessage, state));

          await streamMockLoop(state, push);
          push({
            ...createEvent("completed", "Build completed with local fallback loop.", state),
            payload: {
              source: "mock",
              spec: state.spec ?? fallback,
              artifact:
                state.artifact ??
                renderArtifactFromSpec(state.spec ?? fallback),
            },
          });
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown stream failure";

        push({
          type: "error",
          timestamp: now(),
          message,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
