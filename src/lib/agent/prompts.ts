/**
 * Planner Prompt Templates
 *
 * The model CANNOT perform tool/function calling. We make it emit a STRICT JSON
 * object representing a plan. This file centralizes system & user prompt
 * construction plus few-shot examples to bias the model toward correct structure.
 *
 * IMPORTANT:
 *  - Output MUST be a single JSON object (no markdown fencing, no prose).
 *  - If the model includes extra text, downstream parser will attempt extraction
 *    but we strive to minimize that need.
 *  - All step IDs must be unique, snake_case or simple alphanumeric.
 *  - Step order is the execution order (sequential). Dependencies are expressed
 *    by referencing prior step IDs in params.sourceStepId(s).
 */

import { StepKind } from './types'

/* ---------------------------------- *
 * Canonical Plan JSON Schema (string)
 * ---------------------------------- */
export const PLAN_JSON_SCHEMA_SNIPPET = `
{
  "planId": "string (unique, short id - model can invent)",
  "objective": "Verbatim concise restatement of the user objective",
  "steps": [
    {
      "id": "string-unique-step-id",
      "kind": "QUERY_DATA",
      "title": "Human friendly title",
      "description": "Optional short description",
      "params": {
        "intent": "high_level_query_intent_keyword",
        "limit": 500,
        "filters": {
          "tag": "gaming",
          "campaign": "spring2025"
        }
      }
    },
    {
      "id": "enrich_step",
      "kind": "ENRICH_PROFILE",
      "title": "Enrich selected profiles",
      "params": {
        "sourceStepId": "query_step_1",
        "usernameField": "current_username",
        "maxProfiles": 50
      }
    },
    {
      "id": "report_step",
      "kind": "REPORT",
      "title": "Generate CSV report",
      "params": {
        "sourceStepIds": ["query_step_1","enrich_step"],
        "columns": ["current_username","followers","raw_text"],
        "filename": "profiles_report.csv",
        "format": "CSV"
      }
    }
  ],
  "notes": "Optional reasoning or caveats (concise)"
}
`.trim()

/* ---------------------------------- *
 * Guardrail / Safety Instructions
 * ---------------------------------- */
const SAFETY_DIRECTIVES = `
DO NOT invent SQL.
NEVER include raw SQL or semicolons.
Use only allowed step kinds: QUERY_DATA, ENRICH_PROFILE, REPORT.
If user asks for something unrelated to data or enrichment, still attempt a structured plan if possible or explain minimal plan with a single REPORT referencing no data (rare).
Keep plan minimal: only essential steps.
`.trim()

/* ---------------------------------- *
 * Few-Shot Examples
 * ---------------------------------- */

const FEW_SHOT_1_USER = `Find recent gaming influencers and enrich them, then give me a CSV with their enrichment text.`
const FEW_SHOT_1_PLAN = `
{
  "planId": "example_plan_1",
  "objective": "Identify recent gaming profiles, enrich them, produce CSV",
  "steps": [
    {
      "id": "query_gaming_recent",
      "kind": "QUERY_DATA",
      "title": "Query recent gaming profiles",
      "params": {
        "intent": "recent_gaming_profiles",
        "limit": 100,
        "filters": {
          "tag": "gaming"
        }
      }
    },
    {
      "id": "enrich_gaming_profiles",
      "kind": "ENRICH_PROFILE",
      "title": "Enrich gaming profiles",
      "params": {
        "sourceStepId": "query_gaming_recent",
        "usernameField": "current_username",
        "maxProfiles": 50
      }
    },
    {
      "id": "report_gaming_enrichment",
      "kind": "REPORT",
      "title": "Generate enrichment report CSV",
      "params": {
        "sourceStepIds": ["query_gaming_recent", "enrich_gaming_profiles"],
        "columns": ["current_username","followers","raw_text"],
        "filename": "gaming_enrichment.csv",
        "format": "CSV"
      }
    }
  ],
  "notes": "Limit enrichment to first 50 to stay efficient"
}
`.trim()

const FEW_SHOT_2_USER = `Create a spreadsheet listing the top 20 profiles in the spring campaign including enrichment text.`
const FEW_SHOT_2_PLAN = `
{
  "planId": "example_plan_2",
  "objective": "Produce top 20 spring campaign profiles with enrichment in CSV",
  "steps": [
    {
      "id": "query_spring_top",
      "kind": "QUERY_DATA",
      "title": "Query top spring campaign profiles",
      "params": {
        "intent": "top_profiles_by_campaign",
        "limit": 20,
        "filters": {
          "campaign": "spring"
        }
      }
    },
    {
      "id": "enrich_spring_top",
      "kind": "ENRICH_PROFILE",
      "title": "Enrich top spring campaign profiles",
      "params": {
        "sourceStepId": "query_spring_top",
        "usernameField": "current_username",
        "maxProfiles": 20
      }
    },
    {
      "id": "report_spring_csv",
      "kind": "REPORT",
      "title": "Generate top spring campaign CSV",
      "params": {
        "sourceStepIds": ["query_spring_top","enrich_spring_top"],
        "columns": ["current_username","followers","raw_text"],
        "filename": "spring_top_enriched.csv",
        "format": "CSV"
      }
    }
  ],
  "notes": "Campaign filter 'spring' assumed canonical"
}
`.trim()

const FEW_SHOT_3_USER = `Just give me a CSV of the newest profiles; enrichment not required.`
const FEW_SHOT_3_PLAN = `
{
  "planId": "example_plan_3",
  "objective": "Produce CSV of newest profiles without enrichment",
  "steps": [
    {
      "id": "query_newest_profiles",
      "kind": "QUERY_DATA",
      "title": "Query newest profiles",
      "params": {
        "intent": "recent_profiles",
        "limit": 100
      }
    },
    {
      "id": "report_newest_profiles",
      "kind": "REPORT",
      "title": "Generate newest profiles CSV",
      "params": {
        "sourceStepIds": ["query_newest_profiles"],
        "columns": ["current_username","followers"],
        "filename": "newest_profiles.csv",
        "format": "CSV"
      }
    }
  ],
  "notes": "Skipped enrichment per user request"
}
`.trim()

/* ---------------------------------- *
 * Intent Hints (for the model)
 * ---------------------------------- */
const INTENT_CATALOG = `
Recognized intent labels (examples):
  - recent_profiles
  - recent_gaming_profiles
  - top_profiles_by_campaign
  - profiles_with_tag
  - high_engagement_recent
The model SHOULD choose the closest sensible label, not invent arbitrary long phrases.
`.trim()

/* ---------------------------------- *
 * System Prompt Assembly
 * ---------------------------------- */
export function buildPlannerSystemPrompt(): string {
  return [
    'You are a planning assistant that outputs ONLY valid JSON for a multi-step data plan.',
    'Follow the exact schema. Do not wrap JSON in markdown. No extra commentary.',
    'Each step kind must be one of: QUERY_DATA | ENRICH_PROFILE | REPORT.',
    'Use minimal required steps to accomplish the user objective.',
    'If enrichment is not needed, omit ENRICH_PROFILE.',
    'Column choices in REPORT should reference fields likely available (e.g., current_username, followers, raw_text).',
    'Always include "planId" (short snake_case or alphanumeric), "objective" (concise), and "steps".',
    'Add optional "notes" only if clarifying constraints or assumptions.',
    '',
    'JSON Schema (informal):',
    PLAN_JSON_SCHEMA_SNIPPET,
    '',
    'Guardrails:',
    SAFETY_DIRECTIVES,
    '',
    'Intent Catalog:',
    INTENT_CATALOG,
    '',
    'Few-Shot Examples (for style / structure ONLY):',
    'USER EXAMPLE 1:',
    FEW_SHOT_1_USER,
    'PLAN EXAMPLE 1:',
    FEW_SHOT_1_PLAN,
    'USER EXAMPLE 2:',
    FEW_SHOT_2_USER,
    'PLAN EXAMPLE 2:',
    FEW_SHOT_2_PLAN,
    'USER EXAMPLE 3:',
    FEW_SHOT_3_USER,
    'PLAN EXAMPLE 3:',
    FEW_SHOT_3_PLAN,
  ].join('\n')
}

/* ---------------------------------- *
 * User Prompt Builder
 * ---------------------------------- */
export function buildPlannerUserPrompt(userObjective: string): string {
  return [
    'USER_OBJECTIVE:',
    userObjective.trim(),
    '',
    'Respond with ONLY the JSON plan. No commentary.',
  ].join('\n')
}

/* ---------------------------------- *
 * Combined Prompt Helper
 * ---------------------------------- */
export function buildPlanningPrompts(userObjective: string): {
  system: string
  user: string
} {
  return {
    system: buildPlannerSystemPrompt(),
    user: buildPlannerUserPrompt(userObjective),
  }
}

/* ---------------------------------- *
 * (Optional) Lightweight sanity check
 * ---------------------------------- */
export function estimateIfEnrichmentLikely(userObjective: string): boolean {
  const lower = userObjective.toLowerCase()
  if (/(enrich|context|bio|analy[sz]e content|profile details)/.test(lower)) {
    return true
  }
  // Heuristic: if user explicitly only wants a list/spreadsheet maybe false
  if (/without enrichment|just a csv of/i.test(lower)) {
    return false
  }
  return false
}

/* ---------------------------------- *
 * Debug Introspection Utility
 * ---------------------------------- */
export function debugPrintPlannerPrompts(exampleObjective: string): string {
  const { system, user } = buildPlanningPrompts(exampleObjective)
  return [
    '----- SYSTEM PROMPT START -----',
    system,
    '----- SYSTEM PROMPT END -----',
    '----- USER PROMPT START -----',
    user,
    '----- USER PROMPT END -----',
  ].join('\n')
}

// Re-export StepKind for external consumers of the catalog
export { StepKind as PlannerStepKind }