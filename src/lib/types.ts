export type AgentLog = {
  agent: string;
  focus: string;
  decision: string;
};

export type SectionKind =
  | "hero"
  | "features"
  | "stats"
  | "testimonial"
  | "cta";

export type SectionSpec = {
  kind: SectionKind;
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  metricLabel: string;
  metricValue: string;
  quote: string;
  ctaLabel: string;
  ctaHint: string;
};

export type ThemeSpec = {
  name: string;
  primary: string;
  accent: string;
  surface: string;
  background: string;
  text: string;
};

export type BuildMode = "landing" | "dashboard";

export type AppSpec = {
  projectTitle: string;
  summary: string;
  theme: ThemeSpec;
  agentLogs: AgentLog[];
  sections: SectionSpec[];
  builderNotes: string[];
  suggestedFollowUpPrompts: string[];
};

export type WebArtifact = {
  html: string;
  css: string;
  js: string;
  document: string;
};

export type GeneratedVersion = {
  id: string;
  prompt: string;
  createdAt: string;
  source: "mock" | "openai" | "kimi";
  spec: AppSpec;
  artifact: WebArtifact;
};

export type ProjectRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  brief: string;
  versions: GeneratedVersion[];
  activeVersionId: string | null;
};

export type LoopTodoStatus = "pending" | "in_progress" | "completed";

export type LoopTodo = {
  id: string;
  content: string;
  status: LoopTodoStatus;
  owner?: string;
};

export type LoopSnapshot = {
  buildMode: BuildMode | null;
  currentAgent: string;
  currentPhase: string;
  todos: LoopTodo[];
  audience: string;
  successSignal: string;
  pageGoal: string;
  visualDirection: string;
  sections: string[];
  dashboardKpis: string[];
  filters: string[];
  widgets: string[];
  builderNotes: string[];
};

export type LoopEventType =
  | "status"
  | "tool_call"
  | "tool_result"
  | "assistant"
  | "error"
  | "completed";

export type LoopEvent = {
  type: LoopEventType;
  timestamp: string;
  message: string;
  agent?: string;
  phase?: string;
  snapshot?: LoopSnapshot;
};
