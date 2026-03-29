"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import Image from "next/image";

import { AppPreview } from "@/components/app-preview";
import { renderArtifactFromSpec } from "@/lib/mock-generator";
import type {
  AppSpec,
  GeneratedVersion,
  LoopEvent,
  LoopSnapshot,
  ProjectRecord,
  WebArtifact,
} from "@/lib/types";

const STORAGE_KEY = "atoms-studio-demo:v2";

const DEFAULT_PROMPTS = [
  "帮我制作面向销售团队的业务数据大盘页面。",
  "帮我生成一个医疗自动化助手的官网首页，风格克制可信。",
  "帮我做一个面向创始人的 AI 工作流产品发布页。",
];

const HERO_PROMPTS = [
  "把这个 SaaS 销售 Copilot 做得更像可融资的产品首页",
  "给这个医疗自动化助手做一个更克制、更可信的首页",
  "把这个工作流 Agent 包装成一个面向创始人的产品发布页",
];

const SOURCE_LABELS = {
  kimi: "Kimi 实时",
  openai: "OpenAI 实时",
  mock: "本地保底",
} as const;

type StudioView = "landing" | "workspace";

type StreamCompletedPayload = {
  source: "mock" | "openai" | "kimi";
  spec: AppSpec;
  artifact: WebArtifact;
};

function createId() {
  return crypto.randomUUID();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function fallbackProjectTitle(prompt: string) {
  const cleaned = prompt.trim();
  return cleaned.length > 36 ? `${cleaned.slice(0, 33)}...` : cleaned;
}

function createEmptyProject(prompt: string): ProjectRecord {
  const now = new Date().toISOString();

  return {
    id: createId(),
    createdAt: now,
    updatedAt: now,
    title: fallbackProjectTitle(prompt) || "新建生成",
    brief: prompt,
    versions: [],
    activeVersionId: null,
  };
}

function upsertVersion(
  projects: ProjectRecord[],
  projectId: string,
  version: GeneratedVersion,
) {
  return projects.map((project) => {
    if (project.id !== projectId) {
      return project;
    }

    return {
      ...project,
      updatedAt: version.createdAt,
      title: version.spec.projectTitle,
      brief: version.spec.summary,
      activeVersionId: version.id,
      versions: [version, ...project.versions],
    };
  });
}

function currentVersion(project: ProjectRecord | null) {
  if (project == null || project.activeVersionId == null) {
    return null;
  }

  return (
    project.versions.find((version) => version.id === project.activeVersionId) ??
    null
  );
}

function migrateProjectRecord(project: ProjectRecord): ProjectRecord {
  return {
    ...project,
    versions: project.versions.map((version) => ({
      ...version,
      artifact: version.artifact ?? renderArtifactFromSpec(version.spec),
    })),
  };
}

function parseSseChunk(buffer: string) {
  const frames = buffer.split("\n\n");
  const complete = frames.slice(0, -1);
  const remainder = frames.at(-1) ?? "";

  const events = complete
    .map((frame) =>
      frame
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .map((line) => line.slice(6))
        .join(""),
    )
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as LoopEvent & {
          payload?: StreamCompletedPayload;
        };
      } catch {
        return null;
      }
    })
    .filter((event): event is LoopEvent & { payload?: StreamCompletedPayload } => event != null);

  return { events, remainder };
}

export function AtomsStudio() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<StudioView>("landing");
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [engineSource, setEngineSource] = useState<
    "mock" | "openai" | "kimi" | null
  >(null);
  const [loopEvents, setLoopEvents] = useState<LoopEvent[]>([]);
  const [previewKey, setPreviewKey] = useState(0);
  const [loopSnapshot, setLoopSnapshot] = useState<LoopSnapshot | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);
  const [typedPlaceholder, setTypedPlaceholder] = useState("");

  useEffect(() => {
    if (viewMode !== "landing") return;
    const texts = DEFAULT_PROMPTS;
    let textIndex = 0;
    let charIndex = 0;
    let timer: ReturnType<typeof setTimeout>;

    function tick() {
      const current = texts[textIndex];
      charIndex++;
      setTypedPlaceholder(current.slice(0, charIndex));
      if (charIndex < current.length) {
        timer = setTimeout(tick, 60);
      } else {
        timer = setTimeout(() => {
          charIndex = 0;
          textIndex = (textIndex + 1) % texts.length;
          tick();
        }, 1800);
      }
    }

    timer = setTimeout(tick, 400);
    return () => clearTimeout(timer);
  }, [viewMode]);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (raw != null) {
      try {
        const parsed = JSON.parse(raw) as {
          projects: ProjectRecord[];
          activeProjectId: string | null;
        };

        startTransition(() => {
          const hydratedProjects = (parsed.projects ?? [])
            .map(migrateProjectRecord)
            .filter((project) => project.versions.length > 0);
          const nextActiveProjectId = hydratedProjects.some(
            (project) => project.id === parsed.activeProjectId,
          )
            ? parsed.activeProjectId
            : (hydratedProjects[0]?.id ?? null);

          setProjects(hydratedProjects);
          setActiveProjectId(nextActiveProjectId);
          setViewMode("landing");
        });
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }

    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ projects, activeProjectId }),
    );
  }, [activeProjectId, isHydrated, projects]);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? null,
    [activeProjectId, projects],
  );

  const selectedVersion = currentVersion(activeProject);
  const selectedSpec = selectedVersion?.spec ?? null;
  const recentProjects = projects.slice(0, 3);
  const engineLabel =
    engineSource == null ? "等待首次生成" : SOURCE_LABELS[engineSource];
  const latestEvent = loopEvents.at(-1) ?? null;

  useEffect(() => {
    if (
      viewMode === "workspace" &&
      !isGenerating &&
      selectedVersion == null &&
      activeProjectId == null
    ) {
      setViewMode("landing");
    }
  }, [activeProjectId, isGenerating, selectedVersion, viewMode]);

  useEffect(() => {
    if (logRef.current == null) {
      return;
    }

    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [loopEvents]);

  async function runGeneration({
    targetProjectId,
    forceNew = false,
  }: {
    targetProjectId?: string;
    forceNew?: boolean;
  } = {}) {
    const trimmed = prompt.trim();

    if (trimmed.length < 3) {
      setError("请输入更完整一点的需求。");
      return;
    }

    const project =
      forceNew
        ? null
        : targetProjectId != null
          ? projects.find((item) => item.id === targetProjectId) ?? null
          : activeProject;
    const ensuredProject = project ?? createEmptyProject(trimmed);
    const shouldInsertProject = project == null;

    setError("");
    setIsGenerating(true);
    setViewMode("workspace");
    setLoopEvents([]);
    setLoopSnapshot(null);
    if (forceNew) setActiveProjectId(null);

    try {
      const activeVersion =
        ensuredProject.activeVersionId == null
          ? null
          : ensuredProject.versions.find(
              (version) => version.id === ensuredProject.activeVersionId,
            ) ?? null;

      const response = await fetch("/api/generate/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: trimmed,
          existingSpec: activeVersion?.spec ?? null,
          existingArtifact: activeVersion?.artifact ?? null,
        }),
      });

      if (!response.ok) {
        throw new Error("生成失败");
      }

      if (response.body == null) {
        throw new Error("缺少流式响应内容。");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let completedPayload: StreamCompletedPayload | null = null;

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const parsed = parseSseChunk(buffer);
        buffer = parsed.remainder;

        for (const event of parsed.events) {
          setLoopEvents((current) => [...current, event]);

          if (event.snapshot != null) {
            setLoopSnapshot(event.snapshot);
          }

          if (event.type === "completed" && event.payload != null) {
            completedPayload = event.payload;
          }

          if (event.type === "error") {
            throw new Error(event.message);
          }
        }
      }

      if (completedPayload == null) {
        throw new Error("生成流结束时没有拿到最终结果。");
      }

      const version: GeneratedVersion = {
        id: createId(),
        prompt: trimmed,
        createdAt: new Date().toISOString(),
        source: completedPayload.source,
        spec: completedPayload.spec,
        artifact: completedPayload.artifact,
      };

      setEngineSource(completedPayload.source);
      setProjects((current) => {
        const exists = current.some((item) => item.id === ensuredProject.id);
        const base =
          shouldInsertProject && !exists
            ? [ensuredProject, ...current]
            : current.slice();
        return upsertVersion(base, ensuredProject.id, version);
      });
      setActiveProjectId(ensuredProject.id);
      setPrompt(completedPayload.spec.suggestedFollowUpPrompts[0] ?? trimmed);
      setViewMode("workspace");
    } catch (generationError) {
      console.error(generationError);
      setError("生成失败，请检查 Kimi 配置或稍后重试。");
      setViewMode(project == null ? "landing" : "workspace");
    } finally {
      setIsGenerating(false);
    }
  }

  function startFreshProject(seedPrompt?: string) {
    setPrompt(seedPrompt ?? DEFAULT_PROMPTS[0]);
    setActiveProjectId(null);
    setError("");
    setViewMode("landing");
  }

  function openProject(projectId: string) {
    setActiveProjectId(projectId);
    setError("");
    setViewMode("workspace");
  }

  function resetLocalMemory() {
    window.localStorage.removeItem(STORAGE_KEY);
    setProjects([]);
    setActiveProjectId(null);
    setPrompt(DEFAULT_PROMPTS[0]);
    setError("");
    setEngineSource(null);
    setViewMode("landing");
  }

  function selectVersion(projectId: string, versionId: string) {
    setProjects((current) =>
      current.map((project) =>
        project.id === projectId
          ? { ...project, activeVersionId: versionId }
          : project,
      ),
    );
    setActiveProjectId(projectId);
    setViewMode("workspace");
  }

  if (viewMode === "landing") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-[1480px] flex-col px-4 py-5 lg:px-8">
        <LandingNav
          onOpenWorkspace={
            activeProjectId != null ? () => setViewMode("workspace") : undefined
          }
          onReset={projects.length > 0 ? resetLocalMemory : undefined}
        />
        <section className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-[960px] text-center">
            <Image
              src="/preview.png"
              alt="product preview"
              width={300}
              height={192}
              className="mx-auto mb-6 w-full max-w-[300px] rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.12)]"
            />
            <div className="mt-2 text-xs font-semibold tracking-[0.24em] text-black/40">
              AI 产品工作台
            </div>
            <h1 className="mt-4 text-5xl font-semibold tracking-tight text-black md:text-6xl">
              把想法变成可销售的产品
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-black/56 md:text-lg">
              AI 员工用于验证想法、构建产品并获取客户。几分钟内完成。无需编码。
            </p>

            <section className="glass-panel-strong mx-auto mt-8 max-w-[780px] rounded-[2rem] p-4 text-left">
              <textarea
                className="min-h-40 w-full resize-none rounded-[1.5rem] bg-white px-5 py-5 text-base leading-8 text-black outline-none"
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !isGenerating) {
                    event.preventDefault();
                    void runGeneration({ forceNew: true });
                  }
                }}
                placeholder={typedPlaceholder}
                value={prompt}
              />
              <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
                <button
                  className="rounded-full bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2c2c2c] disabled:cursor-not-allowed disabled:opacity-55"
                  disabled={isGenerating}
                  onClick={() => void runGeneration({ forceNew: true })}
                  type="button"
                >
                  {isGenerating ? "生成中..." : "开始生成"}
                </button>
              </div>
            </section>

            <div className="mx-auto mt-5 flex max-w-[860px] flex-wrap justify-center gap-2">
              {HERO_PROMPTS.map((item) => (
                <button
                  key={item}
                  className="rounded-full border border-black/8 bg-white/72 px-4 py-2 text-sm text-black/62 transition hover:bg-white"
                  onClick={() => setPrompt(item)}
                  type="button"
                >
                  {item}
                </button>
              ))}
            </div>

            {error ? (
              <div className="mx-auto mt-5 max-w-[780px] rounded-[1.2rem] border border-red-200 bg-red-50 px-4 py-3 text-left text-sm text-red-700">
                {error}
              </div>
            ) : null}

            {projects.length > 0 ? (
              <section className="mx-auto mt-8 max-w-[980px] rounded-[1.8rem] border border-black/8 bg-white/72 p-4 text-left shadow-[0_16px_34px_rgba(0,0,0,0.05)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold tracking-[0.24em] text-black/42">
                      最近会话
                    </div>
                    <div className="mt-1 text-sm text-black/56">
                      历史版本仍会保留，但重新打开时默认先回到首页。
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {activeProjectId != null ? (
                      <button
                        className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-black hover:text-white"
                        onClick={() => setViewMode("workspace")}
                        type="button"
                      >
                        回到当前会话
                      </button>
                    ) : null}
                    <button
                      className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-black hover:text-white"
                      onClick={resetLocalMemory}
                      type="button"
                    >
                      清空本地记忆
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {recentProjects.map((project) => (
                    <button
                      key={project.id}
                      className="rounded-[1.5rem] border border-black/8 bg-white/82 p-4 text-left transition hover:bg-white"
                      onClick={() => openProject(project.id)}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-black">
                          {project.title}
                        </div>
                        <div className="text-xs text-black/42">
                          {formatDate(project.updatedAt)}
                        </div>
                      </div>
                      <div className="mt-2 line-clamp-2 text-sm leading-6 text-black/58">
                        {project.brief}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Pill>项目 {projects.length}</Pill>
                  <Pill>
                    版本 {projects.reduce((sum, item) => sum + item.versions.length, 0)}
                  </Pill>
                  <Pill>浏览器本地持久化</Pill>
                </div>
              </section>
            ) : null}

          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="flex h-screen w-full flex-col">
      <div className="flex flex-1 flex-col overflow-hidden border border-white/10 bg-[#0b0b0d]">
        <div className="grid h-14 items-center border-b border-white/8 bg-[#070709] px-3 text-white/72 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="flex items-center gap-2">
            <button
              className="rounded-full border border-white/10 bg-white/4 px-3 py-1.5 text-sm transition hover:bg-white/8"
              onClick={() => setViewMode("landing")}
              type="button"
            >
              全部会话
            </button>
            <div className="text-sm text-white/44">
              {selectedSpec?.projectTitle ?? "新的生成任务"}
            </div>
          </div>
          <div className="hidden items-center gap-2 lg:flex">
            <div className="flex items-center gap-2 text-sm text-white/48">
              <span className={`h-2 w-2 rounded-full ${isGenerating ? "bg-[#ff9a62]" : "bg-[#67d58c]"}`} />
              <span>{engineLabel}</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {activeProject?.versions.slice(0, 4).map((version, index) => {
                const active = version.id === activeProject.activeVersionId;
                return (
                  <button
                    key={version.id}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      active
                        ? "bg-white text-black"
                        : "border border-white/10 bg-white/4 text-white/62 hover:bg-white/8"
                    }`}
                    onClick={() => selectVersion(activeProject.id, version.id)}
                    type="button"
                  >
                    版本 {activeProject.versions.length - index}
                  </button>
                );
              })}
              {projects.length > 0 ? (
                <button
                  className="rounded-full border border-white/10 bg-white/4 px-3 py-1.5 text-xs text-white/62 transition hover:bg-white/8"
                  onClick={resetLocalMemory}
                  type="button"
                >
                  清空记忆
                </button>
              ) : null}
              <UserButton />
            </div>
          </div>
        </div>

        <section className="grid h-[calc(100vh-3.5rem)] overflow-hidden lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="flex h-full min-h-0 flex-col overflow-hidden border-r border-white/8 bg-[#0b0b0d] text-white">
            <div className="border-b border-white/8 px-4 py-4">
              <div className="text-[11px] font-semibold tracking-[0.24em] text-white/32">
                对话
              </div>
              <div className="mt-2 text-lg font-semibold text-white/92">
                {selectedSpec?.projectTitle ?? "新的生成任务"}
              </div>
              <div className="mt-2 flex items-center gap-2 text-sm text-white/46">
                <span className={`h-2 w-2 rounded-full ${isGenerating ? "bg-[#ff9a62]" : "bg-[#67d58c]"}`} />
                <span>{isGenerating ? "Agent 正在执行" : "等待你的下一条输入"}</span>
              </div>
            </div>

            <div
              ref={logRef}
              className="scroll-soft min-h-0 flex-1 overflow-auto px-4 py-5"
            >
              <div className="space-y-3 pb-6">
                {/* 用户 prompt */}
                <div className="rounded-[1rem] bg-white/8 px-4 py-3">
                  <div className="text-[10px] font-semibold tracking-[0.2em] text-white/30 mb-1">任务</div>
                  <div className="text-sm leading-6 text-white/86">{selectedVersion?.prompt ?? prompt}</div>
                </div>

                {/* 执行计划 — 紧凑步骤列表 */}
                {(loopSnapshot?.todos ?? []).length > 0 ? (
                  <div className="rounded-[1rem] border border-white/8 bg-white/3 px-4 py-3">
                    <div className="text-[10px] font-semibold tracking-[0.2em] text-white/30 mb-2">执行计划</div>
                    <div className="space-y-1.5">
                      {(loopSnapshot?.todos ?? []).map((todo) => (
                        <div key={todo.id} className="flex items-start gap-2">
                          <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                            todo.status === "completed"
                              ? "bg-[#67d58c]"
                              : todo.status === "in_progress"
                                ? "bg-[#ff9a62] animate-pulse"
                                : "bg-white/20"
                          }`} />
                          <span className={`text-xs leading-5 ${
                            todo.status === "completed"
                              ? "text-white/36 line-through"
                              : todo.status === "in_progress"
                                ? "text-white/90"
                                : "text-white/42"
                          }`}>{todo.content}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* 当前实时步骤 — 仅显示最新事件 */}
                {isGenerating ? (
                  latestEvent == null ? (
                    <div className="flex items-center gap-3 rounded-[1rem] border border-white/8 bg-white/3 px-4 py-3">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#ff9a62] animate-pulse" />
                      <span className="text-xs text-white/46">Agent 初始化中…</span>
                    </div>
                  ) : (
                    <div className="rounded-[1rem] border border-[#ff9a62]/20 bg-[#ff9a62]/5 px-4 py-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#ff9a62] animate-pulse" />
                        <span className="text-[10px] font-semibold tracking-[0.2em] text-[#ff9a62]/70">
                          {latestEvent.agent ?? formatEventType(latestEvent.type)} · {formatEventType(latestEvent.type)}
                        </span>
                      </div>
                      <div className="text-xs leading-5 text-white/78">{latestEvent.message}</div>
                    </div>
                  )
                ) : null}

                {/* 完成后摘要 */}
                {!isGenerating && selectedSpec ? (
                  <div className="rounded-[1rem] border border-[#67d58c]/20 bg-[#67d58c]/5 px-4 py-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#67d58c]" />
                      <span className="text-[10px] font-semibold tracking-[0.2em] text-[#67d58c]/70">生成完成</span>
                    </div>
                    <div className="text-sm font-medium text-white/90">{selectedSpec.projectTitle}</div>
                    <div className="mt-1 text-xs leading-5 text-white/50 line-clamp-3">{selectedSpec.summary}</div>
                    {selectedSpec.suggestedFollowUpPrompts.length > 0 ? (
                      <div className="mt-3 space-y-1.5">
                        <div className="text-[10px] font-semibold tracking-[0.2em] text-white/28">建议继续</div>
                        {selectedSpec.suggestedFollowUpPrompts.slice(0, 2).map((s, i) => (
                          <button
                            key={i}
                            className="block w-full rounded-lg border border-white/8 bg-white/4 px-3 py-2 text-left text-xs text-white/38 backdrop-blur-sm transition hover:bg-white/8 hover:text-white/60"
                            onClick={() => {
                              setPrompt(s);
                              void runGeneration({
                                targetProjectId: activeProjectId ?? undefined,
                                forceNew: false,
                              });
                            }}
                            type="button"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {/* 空状态 */}
                {!isGenerating && !selectedSpec ? (
                  <div className="flex items-center gap-3 rounded-[1rem] border border-white/8 bg-white/3 px-4 py-3">
                    <span className="text-xs text-white/36">发送需求后，这里会实时展示 Agent 执行过程。</span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="border-t border-white/8 bg-[#09090b] px-4 py-4">
              <div className="rounded-[1.15rem] border border-white/10 bg-[#111115] p-3 shadow-[0_12px_30px_rgba(0,0,0,0.2)]">
                <textarea
                  className="max-h-48 min-h-24 w-full resize-none bg-transparent px-1 py-2 text-sm leading-7 text-white outline-none placeholder:text-white/28 disabled:opacity-40"
                  disabled={isGenerating}
                  onChange={(event) => {
                    setPrompt(event.target.value);
                    event.target.style.height = "auto";
                    event.target.style.height = `${event.target.scrollHeight}px`;
                  }}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !isGenerating) {
                      event.preventDefault();
                      void runGeneration({
                        targetProjectId: activeProjectId ?? undefined,
                        forceNew: activeProjectId == null,
                      });
                    }
                  }}
                  placeholder="例如：把这个销售大盘改成深色风格，并增加负责人排行榜。"
                  value={prompt}
                />
                <div className="mt-3 flex flex-wrap items-center justify-end gap-3 border-t border-white/8 pt-3">
                    <button
                      className="rounded-full border border-white/10 bg-white/4 px-4 py-2 text-sm font-medium text-white/72 transition hover:bg-white/8"
                      onClick={() => startFreshProject(prompt)}
                      type="button"
                    >
                      新会话
                    </button>
                    <button
                      className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/92 disabled:cursor-not-allowed disabled:opacity-55"
                      disabled={isGenerating}
                      onClick={() =>
                        void runGeneration({
                          targetProjectId: activeProjectId ?? undefined,
                          forceNew: activeProjectId == null,
                        })
                      }
                      type="button"
                    >
                      {selectedSpec == null ? "发送" : "继续生成"}
                    </button>
                </div>
              </div>
              {error ? (
                <div className="mt-3 rounded-[1rem] border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              ) : null}
            </div>
          </aside>

          <section className="flex h-full min-h-0 flex-col overflow-hidden bg-[#0f1014]">
            <div className="flex items-center gap-2 border-b border-white/8 bg-[#0b0c0f] px-3 py-2.5">
              <button
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/8 bg-white/4 text-white/56 transition hover:bg-white/8"
                onClick={() => setPreviewKey((k) => k + 1)}
                title="刷新预览"
                type="button"
              >
                ↻
              </button>
              <div className="ml-1 flex h-8 flex-1 items-center rounded-full border border-white/8 bg-white/4 px-4 text-sm text-white/38">
                {selectedSpec?.projectTitle ?? "本地预览"}
              </div>
            </div>
            <div className="mb-3 flex items-center justify-between gap-3 px-3 pt-3 text-sm text-white/50 lg:hidden">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${isGenerating ? "bg-[#ff9a62]" : "bg-[#67d58c]"}`} />
                  <span>{engineLabel}</span>
                </div>
                <button
                  className="rounded-full border border-white/10 bg-white/4 px-3 py-1.5 text-xs text-white/62 transition hover:bg-white/8"
                  onClick={resetLocalMemory}
                  type="button"
                >
                  清空记忆
                </button>
              </div>
            <div className="min-h-0 h-full w-full flex-1 overflow-hidden">
              <AppPreview
                artifact={selectedVersion?.artifact ?? null}
                reloadKey={previewKey}
                spec={selectedSpec}
              />
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

function formatEventType(type: LoopEvent["type"]) {
  const labels: Record<LoopEvent["type"], string> = {
    status: "状态",
    tool_call: "工具调用",
    tool_result: "工具结果",
    assistant: "Agent 输出",
    error: "错误",
    completed: "完成",
  };

  return labels[type];
}

function LandingNav({
  onOpenWorkspace,
  onGoHome,
  onReset,
}: {
  onOpenWorkspace?: () => void;
  onGoHome?: () => void;
  onReset?: () => void;
}) {
  return (
    <header className="flex flex-wrap items-center justify-end gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {onGoHome ? (
          <button
            className="rounded-full border border-black/8 bg-white/74 px-3 py-2 text-xs font-medium text-black/60 transition hover:bg-white"
            onClick={onGoHome}
            type="button"
          >
            返回首页
          </button>
        ) : null}
        {onOpenWorkspace ? (
          <button
            className="rounded-full border border-black/8 bg-white/74 px-3 py-2 text-xs font-medium text-black/60 transition hover:bg-white"
            onClick={onOpenWorkspace}
            type="button"
          >
            打开结果页
          </button>
        ) : null}
        {onReset ? (
          <button
            className="rounded-full border border-black/8 bg-white/74 px-3 py-2 text-xs font-medium text-black/60 transition hover:bg-white"
            onClick={onReset}
            type="button"
          >
            清空本地记忆
          </button>
        ) : null}
      </div>
    </header>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-full border border-black/8 bg-white/72 px-3 py-2 text-xs font-medium text-black/56">
      {children}
    </div>
  );
}
