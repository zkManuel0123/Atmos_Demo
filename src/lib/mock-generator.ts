import type { AppSpec, SectionKind, ThemeSpec, WebArtifact } from "@/lib/types";

const THEMES: ThemeSpec[] = [
  {
    name: "Signal Ember",
    primary: "#d96b1d",
    accent: "#ffb347",
    surface: "#fff6ea",
    background: "#fffaf2",
    text: "#20160f",
  },
  {
    name: "Ocean Ledger",
    primary: "#0e7490",
    accent: "#67e8f9",
    surface: "#ecfeff",
    background: "#f5feff",
    text: "#12313a",
  },
  {
    name: "Forest Ops",
    primary: "#217346",
    accent: "#86efac",
    surface: "#effdf5",
    background: "#f7fff9",
    text: "#112a18",
  },
  {
    name: "Midnight Circuit",
    primary: "#334155",
    accent: "#a5b4fc",
    surface: "#eef2ff",
    background: "#f8faff",
    text: "#18212b",
  },
];

const HERO_LINES = [
  "Ship an opinionated product story before the demo window closes.",
  "Turn one sentence into an experience that already feels fundable.",
  "Move from vague idea to previewable artifact in one agentic loop.",
];

const FEATURE_BANK = [
  "Structured app planning with visible agent roles",
  "Versioned previews for every generation run",
  "Fast prompt refinement without losing earlier drafts",
  "Design tokens that keep every generated screen coherent",
  "A shareable artifact instead of a dead chat transcript",
];

const FOLLOW_UPS = [
  "Add a pricing section for enterprise buyers.",
  "Make the tone more premium and investor-facing.",
  "Turn this into a mobile-first landing page.",
  "Emphasize trust, security, and workflow automation.",
];

function isDashboardPrompt(prompt: string, existingSpec?: AppSpec | null) {
  const content = [
    prompt,
    existingSpec?.projectTitle ?? "",
    existingSpec?.summary ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return (
    content.includes("dashboard") ||
    content.includes("大盘") ||
    content.includes("看板") ||
    content.includes("数据") ||
    content.includes("pipeline") ||
    content.includes("revenue") ||
    content.includes("sales")
  );
}

function pickTheme(prompt: string): ThemeSpec {
  const lower = prompt.toLowerCase();

  if (
    lower.includes("finance") ||
    lower.includes("bank") ||
    lower.includes("fintech")
  ) {
    return THEMES[3];
  }

  if (
    lower.includes("health") ||
    lower.includes("care") ||
    lower.includes("wellness")
  ) {
    return THEMES[1];
  }

  if (
    lower.includes("productivity") ||
    lower.includes("ops") ||
    lower.includes("workflow")
  ) {
    return THEMES[2];
  }

  return THEMES[0];
}

function toTitle(prompt: string): string {
  const cleaned = prompt
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.。!！?？]/g, "");

  if (!cleaned) {
    return "Untitled Studio Build";
  }

  const short = cleaned.length > 48 ? `${cleaned.slice(0, 45)}...` : cleaned;
  return short
    .split(" ")
    .slice(0, 6)
    .join(" ")
    .replace(/^./, (value) => value.toUpperCase());
}

function inferAudience(prompt: string): string {
  const lower = prompt.toLowerCase();

  if (lower.includes("founder") || lower.includes("startup")) {
    return "founders moving from idea to launch";
  }

  if (lower.includes("developer") || lower.includes("engineer")) {
    return "technical teams shipping internal tools";
  }

  if (lower.includes("sales") || lower.includes("marketing")) {
    return "go-to-market teams chasing clarity";
  }

  return "teams who need an AI-native workflow";
}

function buildSection(
  kind: SectionKind,
  prompt: string,
  theme: ThemeSpec,
  existingTitle: string,
  dashboardMode: boolean,
): AppSpec["sections"][number] {
  const audience = inferAudience(prompt);

  if (kind === "hero") {
    return {
      kind,
      eyebrow: dashboardMode ? "REVENUE COMMAND CENTER" : "AGENTIC PRODUCT STUDIO",
      title: existingTitle,
      description: dashboardMode
        ? `A focused sales operations dashboard for ${audience}, designed to surface pipeline health, owner performance, and conversion risk in one glance.`
        : `${HERO_LINES[prompt.length % HERO_LINES.length]} This concept is positioned for ${audience}.`,
      bullets: dashboardMode
        ? [
            "Data Analyst prioritizes the metrics that sales leaders actually review.",
            "Product Designer turns dense information into a scannable layout.",
            "Engineer assembles a previewable dashboard artifact.",
          ]
        : [
            "Planner drafts the structure before any UI appears.",
            "Architect aligns data, sections, and user flow.",
            "Engineer composes a previewable page spec.",
          ],
      metricLabel: dashboardMode ? "Coverage" : "Launch window",
      metricValue: dashboardMode ? "24 active deals" : "6-8h",
      quote: "",
      ctaLabel: dashboardMode ? "Review pipeline" : "Generate next version",
      ctaHint: `Theme tuned with ${theme.name}.`,
    };
  }

  if (kind === "features") {
    return {
      kind,
      eyebrow: dashboardMode ? "CONTROL SURFACE" : "WHY THIS DIRECTION",
      title: dashboardMode
        ? "Filters and modules built for weekly sales review"
        : "A builder that feels like a product, not a toy",
      description: dashboardMode
        ? "The dashboard groups the operating surface into filters, segments, pipeline views, and owner comparisons so a manager can act quickly."
        : "The generated artifact is opinionated enough for a demo while staying editable for follow-up iterations.",
      bullets: dashboardMode
        ? [
            "Date range, team, and region filters anchor the top of the page.",
            "Pipeline stages and win-rate trends stay visible above the fold.",
            "Owner leaderboard and deal list support immediate drill-down.",
          ]
        : FEATURE_BANK.slice(0, 3 + (prompt.length % 2)),
      metricLabel: "",
      metricValue: "",
      quote: "",
      ctaLabel: "",
      ctaHint: "",
    };
  }

  if (kind === "stats") {
    return {
      kind,
      eyebrow: dashboardMode ? "KPI SNAPSHOT" : "DELIVERY SIGNALS",
      title: dashboardMode
        ? "Top-line numbers stay visible and actionable"
        : "Built to communicate speed and confidence",
      description: dashboardMode
        ? "This layer highlights pipeline value, quota coverage, stage conversion, and risk so the page reads like a working sales cockpit."
        : "This section makes the prototype look measurable instead of purely generative.",
      bullets: dashboardMode
        ? [
            "Use concise trend chips instead of long explanations.",
            "Separate healthy metrics from at-risk metrics with clear contrast.",
          ]
        : [
            "Visible build steps reassure the user that work is happening.",
            "Version history gives you a narrative for the interview demo.",
          ],
      metricLabel: dashboardMode ? "Quota attainment" : "Iterations saved",
      metricValue: dashboardMode ? "78%" : `${3 + (prompt.length % 5)} versions`,
      quote: "",
      ctaLabel: "",
      ctaHint: "",
    };
  }

  if (kind === "testimonial") {
    return {
      kind,
      eyebrow: dashboardMode ? "INSIGHT LAYER" : "SOCIAL PROOF",
      title: dashboardMode
        ? "A narrative insight keeps the dashboard from feeling raw"
        : "Why this prototype direction is believable",
      description: dashboardMode
        ? "A short analyst readout explains what changed this week and why the team should care."
        : "Adding a single narrative quote makes the generated preview feel closer to a launch-ready page.",
      bullets: [],
      metricLabel: "",
      metricValue: "",
      quote: dashboardMode
        ? "Pipeline coverage is healthy at the top, but stage-three conversion slipped this week. Focus on mid-funnel coaching before adding more top-of-funnel volume."
        : "We needed a product story, a workflow, and a visual demo in one place. This builder gave us all three.",
      ctaLabel: "",
      ctaHint: dashboardMode
        ? "Narrative insight used to make the mock dashboard feel operational."
        : "Fictional testimonial used for demo polish.",
    };
  }

  return {
    kind,
    eyebrow: dashboardMode ? "NEXT ACTIONS" : "NEXT MOVE",
    title: dashboardMode
      ? "Turn the dashboard into a usable sales review ritual"
      : "Iterate until the artifact looks inevitable",
    description: dashboardMode
      ? "Use follow-up prompts to add segments, more detailed tables, alert states, or executive summary modules without rebuilding the whole page."
      : "Use natural language follow-ups to keep evolving the generated screen without restarting from zero.",
    bullets: dashboardMode
      ? [
          "Add risk flags, owner drill-down, or region comparisons.",
          "Preserve version history for weekly review variations.",
        ]
      : [
          "Refine tone, structure, and offer positioning.",
          "Preserve version history for later comparison.",
        ],
    metricLabel: "",
    metricValue: "",
    quote: "",
    ctaLabel: dashboardMode ? "Refine dashboard" : "Ask for a tighter version",
    ctaHint: dashboardMode
      ? "Try adding pipeline risk alerts or a leaderboard."
      : "Try adding pricing, case studies, or a trust section.",
  };
}

export function generateMockSpec(
  prompt: string,
  existingSpec?: AppSpec | null,
): AppSpec {
  const theme = pickTheme(prompt);
  const dashboardMode = isDashboardPrompt(prompt, existingSpec);
  const existingTitle = existingSpec?.projectTitle ?? toTitle(prompt);
  const sections: SectionKind[] = [
    "hero",
    "features",
    "stats",
    "testimonial",
    "cta",
  ];

  return {
    projectTitle: existingTitle,
    summary:
      dashboardMode
        ? existingSpec == null
          ? "A fresh dashboard build direction focused on revenue visibility, pipeline health, and sales execution."
          : "A refined dashboard version that preserves the original metrics view while improving layout and decision support."
        : existingSpec == null
          ? "A fresh Atoms-like build direction assembled from one prompt."
          : "A refined version that preserves the previous direction while tightening the product story.",
    theme,
    agentLogs: [
      {
        agent: "Team Lead",
        focus: "Scope control",
        decision: dashboardMode
          ? "Kept the build inside a single sales dashboard surface so the demo reads like an internal product, not a generic BI tool."
          : "Kept the build inside a single high-conviction landing page so the demo stays shippable.",
      },
      {
        agent: dashboardMode ? "Data Analyst" : "Product Manager",
        focus: dashboardMode ? "Metric framing" : "Audience framing",
        decision: dashboardMode
          ? "Centered the dashboard on pipeline value, win rate, quota attainment, and owner-level execution."
          : `Positioned the experience for ${inferAudience(prompt)}.`,
      },
      {
        agent: dashboardMode ? "Product Designer" : "Architect",
        focus: "Page structure",
        decision: dashboardMode
          ? "Used a KPI-first dashboard layout with a chart row, risk insight panel, and deal table for quick scanning."
          : "Used a five-section arc so the preview looks intentional and easy to iterate.",
      },
      {
        agent: "Engineer",
        focus: "Preview strategy",
        decision: dashboardMode
          ? "Converted the prompt into a dashboard artifact with cards, chart placeholders, and dense but readable panels."
          : "Converted the prompt into a deterministic page spec that can render instantly in-browser.",
      },
    ],
    sections: sections.map((kind) =>
      buildSection(kind, prompt, theme, existingTitle, dashboardMode),
    ),
    builderNotes: [
      dashboardMode
        ? "This build favors information density and decision support over hero-copy polish."
        : "Local-first persistence keeps the demo reliable without external setup.",
      dashboardMode
        ? "The dashboard should feel like a real weekly review surface with clear KPIs, lists, and risk callouts."
        : "The preview is schema-driven, which makes iterative edits cheap and visible.",
      existingSpec == null
        ? dashboardMode
          ? "First run favors a stable KPI layout over niche chart complexity."
          : "First run favors clarity over complexity."
        : dashboardMode
          ? "Refinement preserved the existing metrics frame and tightened visual hierarchy."
          : "Refinement preserved the previous concept and focused on higher-quality presentation.",
    ],
    suggestedFollowUpPrompts: dashboardMode
      ? [
          "给这个销售大盘增加区域筛选和负责人排行榜。",
          "增加 pipeline 风险预警和本周重点 deal 列表。",
          "把这个页面做得更像企业内部销售指挥台。",
          "加入月度目标、完成率和趋势图对比。",
        ]
      : FOLLOW_UPS,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderArtifactFromSpec(spec: AppSpec): WebArtifact {
  const dashboardMode = isDashboardPrompt(
    `${spec.projectTitle} ${spec.summary} ${spec.builderNotes.join(" ")}`,
  );

  if (dashboardMode) {
    return renderDashboardArtifact(spec);
  }

  const html = `
<div class="shell">
  <header class="hero">
    <div class="eyebrow">${escapeHtml(spec.sections[0]?.eyebrow ?? "")}</div>
    <h1>${escapeHtml(spec.projectTitle)}</h1>
    <p class="summary">${escapeHtml(spec.summary)}</p>
    <div class="hero-actions">
      <button>${escapeHtml(spec.sections[0]?.ctaLabel ?? "Get started")}</button>
      <span>${escapeHtml(spec.sections[0]?.ctaHint ?? "")}</span>
    </div>
  </header>
  <main class="content">
    ${spec.sections
      .map((section) => {
        const bullets = section.bullets
          .map((bullet) => `<li>${escapeHtml(bullet)}</li>`)
          .join("");

        return `
        <section class="card section-${section.kind}">
          <div class="eyebrow">${escapeHtml(section.eyebrow)}</div>
          <h2>${escapeHtml(section.title)}</h2>
          <p>${escapeHtml(section.description)}</p>
          ${bullets ? `<ul>${bullets}</ul>` : ""}
          ${
            section.quote
              ? `<blockquote>${escapeHtml(section.quote)}</blockquote>`
              : ""
          }
          ${
            section.metricLabel || section.metricValue
              ? `<div class="metric"><span>${escapeHtml(
                  section.metricLabel,
                )}</span><strong>${escapeHtml(section.metricValue)}</strong></div>`
              : ""
          }
        </section>
      `;
      })
      .join("")}
  </main>
</div>`.trim();

  const css = `
:root {
  --primary: ${spec.theme.primary};
  --accent: ${spec.theme.accent};
  --surface: ${spec.theme.surface};
  --background: ${spec.theme.background};
  --text: ${spec.theme.text};
}

* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  color: var(--text);
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--accent) 18%, transparent), transparent 28%),
    linear-gradient(180deg, #ffffff 0%, var(--background) 100%);
}
.shell {
  max-width: 1100px;
  margin: 0 auto;
  padding: 40px 20px 80px;
}
.hero {
  padding: 48px;
  border-radius: 32px;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  color: white;
  box-shadow: 0 24px 70px rgba(0,0,0,0.12);
}
.eyebrow {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  opacity: 0.74;
}
h1, h2, p, ul, blockquote { margin: 0; }
h1 {
  margin-top: 14px;
  font-size: clamp(40px, 7vw, 72px);
  line-height: 0.95;
}
.summary, .hero p {
  margin-top: 18px;
  max-width: 720px;
  font-size: 18px;
  line-height: 1.8;
}
.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  margin-top: 24px;
}
.hero-actions button {
  border: 0;
  border-radius: 999px;
  padding: 14px 22px;
  font-weight: 700;
  background: white;
  color: var(--primary);
}
.hero-actions span {
  border: 1px solid rgba(255,255,255,0.24);
  border-radius: 999px;
  padding: 13px 18px;
}
.content {
  display: grid;
  gap: 18px;
  margin-top: 22px;
}
.card {
  background: rgba(255,255,255,0.82);
  border: 1px solid rgba(15, 23, 42, 0.07);
  border-radius: 28px;
  padding: 30px;
  box-shadow: 0 18px 48px rgba(15,23,42,0.06);
}
h2 {
  margin-top: 10px;
  font-size: 30px;
  line-height: 1.1;
}
.card p {
  margin-top: 12px;
  font-size: 16px;
  line-height: 1.8;
  color: rgba(15, 23, 42, 0.74);
}
ul {
  margin-top: 16px;
  padding-left: 18px;
  display: grid;
  gap: 10px;
}
blockquote {
  margin-top: 18px;
  padding: 18px 20px;
  border-radius: 20px;
  background: var(--surface);
  font-size: 20px;
  line-height: 1.6;
}
.metric {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid rgba(15, 23, 42, 0.08);
}
.metric span {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: rgba(15, 23, 42, 0.46);
}
.metric strong {
  font-size: 24px;
  color: var(--primary);
}
@media (max-width: 768px) {
  .shell { padding: 20px 14px 40px; }
  .hero, .card { padding: 22px; border-radius: 24px; }
}
`.trim();

  const js = `
document.querySelectorAll('.hero-actions button').forEach((button) => {
  button.addEventListener('click', () => {
    button.textContent = 'Version saved';
  });
});
`.trim();

  const document = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(spec.projectTitle)}</title>
    <style>${css}</style>
  </head>
  <body>
    ${html}
    <script>${js}</script>
  </body>
</html>`;

  return {
    html,
    css,
    js,
    document,
  };
}

function renderDashboardArtifact(spec: AppSpec): WebArtifact {
  const statsSection = spec.sections.find((section) => section.kind === "stats");
  const featureSection = spec.sections.find((section) => section.kind === "features");
  const insightSection = spec.sections.find(
    (section) => section.kind === "testimonial",
  );
  const actionSection = spec.sections.find((section) => section.kind === "cta");

  const kpis = [
    ["Pipeline value", "$4.82M", "+12.4%"],
    ["Quota attainment", statsSection?.metricValue ?? "78%", "+6.1%"],
    ["Win rate", "29.4%", "+1.8%"],
    ["At-risk deals", "7", "-2"],
  ];

  const html = `
<div class="dashboard-shell">
  <header class="topbar">
    <div>
      <div class="eyebrow">${escapeHtml(spec.sections[0]?.eyebrow ?? "")}</div>
      <h1>${escapeHtml(spec.projectTitle)}</h1>
      <p>${escapeHtml(spec.summary)}</p>
    </div>
    <div class="filters">
      <span>Q1 2026</span>
      <span>North America</span>
      <span>Enterprise</span>
    </div>
  </header>

  <section class="kpi-grid">
    ${kpis
      .map(
        ([label, value, delta]) => `
      <article class="kpi-card">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
        <em>${escapeHtml(delta)}</em>
      </article>`,
      )
      .join("")}
  </section>

  <section class="main-grid">
    <article class="panel chart-panel">
      <div class="panel-head">
        <div>
          <div class="eyebrow">PIPELINE TREND</div>
          <h2>Weekly revenue progression</h2>
        </div>
        <span class="chip">Updated 4m ago</span>
      </div>
      <div class="chart-bars">
        <div style="height: 42%"></div>
        <div style="height: 57%"></div>
        <div style="height: 48%"></div>
        <div style="height: 72%"></div>
        <div style="height: 69%"></div>
        <div style="height: 86%"></div>
        <div style="height: 79%"></div>
      </div>
      <div class="chart-caption">${escapeHtml(
        statsSection?.description ?? "",
      )}</div>
    </article>

    <article class="panel insight-panel">
      <div class="panel-head">
        <div>
          <div class="eyebrow">ANALYST NOTE</div>
          <h2>${escapeHtml(insightSection?.title ?? "Weekly insight")}</h2>
        </div>
      </div>
      <blockquote>${escapeHtml(insightSection?.quote ?? "")}</blockquote>
      <ul>
        ${(featureSection?.bullets ?? [])
          .slice(0, 3)
          .map((item) => `<li>${escapeHtml(item)}</li>`)
          .join("")}
      </ul>
    </article>

    <article class="panel table-panel">
      <div class="panel-head">
        <div>
          <div class="eyebrow">PIPELINE TABLE</div>
          <h2>Highest-value deals</h2>
        </div>
        <span class="chip">24 open deals</span>
      </div>
      <table>
        <thead>
          <tr><th>Account</th><th>Owner</th><th>Stage</th><th>Value</th></tr>
        </thead>
        <tbody>
          <tr><td>Northstar AI</td><td>Olivia</td><td>Proposal</td><td>$480k</td></tr>
          <tr><td>Meridian Cloud</td><td>Ethan</td><td>Negotiation</td><td>$395k</td></tr>
          <tr><td>PulseOps</td><td>Harper</td><td>Discovery</td><td>$220k</td></tr>
          <tr><td>Vector Health</td><td>Noah</td><td>Commit</td><td>$610k</td></tr>
        </tbody>
      </table>
    </article>

    <article class="panel side-panel">
      <div class="panel-head">
        <div>
          <div class="eyebrow">NEXT ACTIONS</div>
          <h2>${escapeHtml(actionSection?.title ?? "Recommended actions")}</h2>
        </div>
      </div>
      <ul class="action-list">
        ${(actionSection?.bullets ?? [])
          .map((item) => `<li>${escapeHtml(item)}</li>`)
          .join("")}
      </ul>
      <button>${escapeHtml(actionSection?.ctaLabel ?? "Refine dashboard")}</button>
    </article>
  </section>
</div>`.trim();

  const css = `
:root {
  --primary: ${spec.theme.primary};
  --accent: ${spec.theme.accent};
  --surface: ${spec.theme.surface};
  --background: ${spec.theme.background};
  --text: ${spec.theme.text};
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  color: var(--text);
  background: linear-gradient(180deg, #f8fafc 0%, var(--background) 100%);
}
.dashboard-shell {
  padding: 28px;
  display: grid;
  gap: 18px;
}
.topbar,
.panel,
.kpi-card {
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255,255,255,0.9);
  box-shadow: 0 14px 36px rgba(15,23,42,0.06);
}
.topbar {
  border-radius: 28px;
  padding: 24px 26px;
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: flex-start;
}
.topbar h1, .topbar p, h2, blockquote, ul, table { margin: 0; }
.topbar h1 {
  margin-top: 10px;
  font-size: clamp(30px, 5vw, 52px);
  line-height: 1;
}
.topbar p {
  margin-top: 12px;
  max-width: 720px;
  line-height: 1.7;
  color: rgba(15,23,42,0.66);
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.filters span, .chip {
  border-radius: 999px;
  background: var(--surface);
  color: var(--primary);
  padding: 10px 14px;
  font-size: 12px;
  font-weight: 700;
}
.eyebrow {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.22em;
  color: rgba(15,23,42,0.44);
  font-weight: 700;
}
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}
.kpi-card {
  border-radius: 22px;
  padding: 18px;
  display: grid;
  gap: 8px;
}
.kpi-card span {
  font-size: 12px;
  color: rgba(15,23,42,0.48);
  text-transform: uppercase;
  letter-spacing: 0.18em;
}
.kpi-card strong {
  font-size: 34px;
  line-height: 1;
}
.kpi-card em {
  font-style: normal;
  color: #167c53;
  font-weight: 700;
}
.main-grid {
  display: grid;
  grid-template-columns: 1.35fr 1fr;
  gap: 16px;
}
.panel {
  border-radius: 26px;
  padding: 22px;
}
.panel-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}
.panel h2 {
  margin-top: 10px;
  font-size: 24px;
  line-height: 1.15;
}
.chart-panel {
  min-height: 320px;
}
.chart-bars {
  margin-top: 22px;
  height: 220px;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 12px;
  align-items: end;
}
.chart-bars div {
  border-radius: 18px 18px 6px 6px;
  background: linear-gradient(180deg, var(--accent), var(--primary));
}
.chart-caption {
  margin-top: 16px;
  color: rgba(15,23,42,0.62);
  line-height: 1.7;
}
.insight-panel blockquote {
  margin-top: 20px;
  padding: 18px;
  border-radius: 20px;
  background: var(--surface);
  line-height: 1.7;
  font-size: 17px;
}
.insight-panel ul,
.action-list {
  margin-top: 18px;
  padding-left: 18px;
  display: grid;
  gap: 10px;
  color: rgba(15,23,42,0.7);
}
.table-panel table {
  width: 100%;
  margin-top: 18px;
  border-collapse: collapse;
}
.table-panel th,
.table-panel td {
  text-align: left;
  padding: 12px 10px;
  border-bottom: 1px solid rgba(15,23,42,0.08);
  font-size: 14px;
}
.side-panel button {
  margin-top: 20px;
  border: 0;
  border-radius: 999px;
  background: var(--primary);
  color: white;
  padding: 13px 18px;
  font-weight: 700;
}
@media (max-width: 980px) {
  .kpi-grid,
  .main-grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 768px) {
  .dashboard-shell {
    padding: 14px;
  }
  .topbar,
  .panel,
  .kpi-card {
    border-radius: 22px;
  }
}
`.trim();

  const js = `
document.querySelectorAll('.filters span').forEach((chip) => {
  chip.addEventListener('click', () => {
    chip.style.opacity = chip.style.opacity === '0.55' ? '1' : '0.55';
  });
});
`.trim();

  const document = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(spec.projectTitle)}</title>
    <style>${css}</style>
  </head>
  <body>
    ${html}
    <script>${js}</script>
  </body>
</html>`;

  return { html, css, js, document };
}
