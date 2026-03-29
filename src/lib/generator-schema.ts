import { z } from "zod";

export const sectionKindSchema = z.enum([
  "hero",
  "features",
  "stats",
  "testimonial",
  "cta",
]);

export const agentLogSchema = z.object({
  agent: z.string(),
  focus: z.string(),
  decision: z.string(),
});

export const sectionSchema = z.object({
  kind: sectionKindSchema,
  eyebrow: z.string(),
  title: z.string(),
  description: z.string(),
  bullets: z.array(z.string()),
  metricLabel: z.string(),
  metricValue: z.string(),
  quote: z.string(),
  ctaLabel: z.string(),
  ctaHint: z.string(),
});

export const themeSchema = z.object({
  name: z.string(),
  primary: z.string(),
  accent: z.string(),
  surface: z.string(),
  background: z.string(),
  text: z.string(),
});

export const appSpecSchema = z.object({
  projectTitle: z.string(),
  summary: z.string(),
  theme: themeSchema,
  agentLogs: z.array(agentLogSchema),
  sections: z.array(sectionSchema),
  builderNotes: z.array(z.string()),
  suggestedFollowUpPrompts: z.array(z.string()),
});

export const webArtifactSchema = z.object({
  html: z.string(),
  css: z.string(),
  js: z.string(),
  document: z.string(),
});

export const generateRequestSchema = z.object({
  prompt: z.string().min(3),
  existingSpec: appSpecSchema.nullable().optional(),
  existingArtifact: webArtifactSchema.nullable().optional(),
});
