/**
 * generate_outreach Tool + Outreach Generation Agent
 *
 * PURPOSE:
 *   Generate personalized cold outreach messages using LinkedIn summaries and LLM.
 *   Uses the existing LLM infrastructure to create contextual, personalized messages
 *   based on LinkedIn profile summaries and configurable templates/tones.
 *
 * SPEC DECISIONS (Phase 2):
 *   - Uses existing LLM client from src/lib/llm.ts
 *   - Configurable message templates and tones
 *   - Batch processing with error handling
 *   - No message storage (ephemeral for reporting only)
 *
 * INPUT (to agent runner):
 *   {
 *     stepId: string
 *     summaries: LinkedInSummaryResult[]  // from LinkedIn research step
 *     messageTemplate?: string            // template type (gaming_partnership, tech_collaboration, etc.)
 *     tone?: string                       // professional, casual, friendly, etc.
 *     companyName?: string               // sender's company
 *     senderName?: string                // sender's name
 *     customPrompt?: string              // override default prompting
 *     maxMessages?: number               // safety limit
 *   }
 *
 * OUTPUT (agent):
 *   {
 *     stepId: string
 *     messages: { username, summary, outreach_message, template, tone }[]
 *     errors: { username: string, code: string, message: string }[]
 *     meta: {
 *       requested: number
 *       attempted: number
 *       succeeded: number
 *       failed: number
 *       template: string
 *       tone: string
 *       durationMs: number
 *     }
 *   }
 */

import { chatCompletion, LLMError } from '../../llm'
import type { LinkedInSummaryResult } from '../../linkedin'

/* ---------------------------------- *
 * Tool Error Wrapper
 * ---------------------------------- */

export type OutreachToolErrorCode =
  | 'NO_SUMMARIES'
  | 'INVALID_PARAM'
  | 'LLM_ERROR'
  | 'INTERNAL'

export class OutreachToolError extends Error {
  code: OutreachToolErrorCode
  constructor(code: OutreachToolErrorCode, message: string) {
    super(message)
    this.name = 'OutreachToolError'
    this.code = code
  }
}

/* ---------------------------------- *
 * Message Templates & Prompts
 * ---------------------------------- */

interface MessageTemplate {
  name: string
  description: string
  systemPrompt: string
  userPromptTemplate: string
}

const MESSAGE_TEMPLATES: Record<string, MessageTemplate> = {
  gaming_partnership: {
    name: 'Gaming Partnership',
    description: 'Professional outreach for gaming industry partnerships',
    systemPrompt: `You are a professional outreach specialist writing personalized LinkedIn connection requests for gaming industry partnerships. Your messages should be:
- Professional but friendly
- Specific to the person's background
- Focused on mutual value and collaboration
- Brief (under 150 words)
- Include a clear call-to-action`,
    userPromptTemplate: `Write a personalized LinkedIn connection request to {{displayName}} (username: {{username}}) based on their profile summary.
    
Profile Summary: {{summary}}
Company: {{companyName}}
Sender: {{senderName}}
Tone: {{tone}}

Focus on gaming industry partnerships and collaboration opportunities. Be specific about their background and suggest concrete ways to work together. Use their real name "{{realName}}" in the message if available, not their username.`
  },
  
  tech_collaboration: {
    name: 'Tech Collaboration',
    description: 'Professional outreach for technology collaborations',
    systemPrompt: `You are a professional outreach specialist writing personalized LinkedIn connection requests for technology collaborations. Your messages should be:
- Professional and technical
- Highlight relevant technical expertise
- Suggest specific collaboration opportunities
- Brief (under 150 words)
- Include a clear next step`,
    userPromptTemplate: `Write a personalized LinkedIn connection request to {{displayName}} (username: {{username}}) based on their profile summary.

Profile Summary: {{summary}}
Company: {{companyName}}
Sender: {{senderName}}
Tone: {{tone}}

Focus on technology collaboration opportunities. Reference their technical background and suggest specific ways to collaborate. Use their real name "{{realName}}" in the message if available, not their username.`
  },
  
  content_creator: {
    name: 'Content Creator',
    description: 'Outreach for content creators and influencers',
    systemPrompt: `You are a professional outreach specialist writing personalized LinkedIn connection requests for content creator partnerships. Your messages should be:
- Enthusiastic but professional
- Reference their content style/niche
- Suggest partnership opportunities
- Brief (under 150 words)
- Show genuine interest in their work`,
    userPromptTemplate: `Write a personalized LinkedIn connection request to {{displayName}} (username: {{username}}) based on their profile summary.

Profile Summary: {{summary}}
Company: {{companyName}}
Sender: {{senderName}}
Tone: {{tone}}

Focus on content creation partnerships. Reference their content style and suggest collaboration opportunities. Use their real name "{{realName}}" in the message if available, not their username.`
  },
  
  generic_professional: {
    name: 'Generic Professional',
    description: 'General professional networking outreach',
    systemPrompt: `You are a professional outreach specialist writing personalized LinkedIn connection requests. Your messages should be:
- Professional and respectful
- Personalized to their background
- Suggest mutual networking value
- Brief (under 150 words)
- Include a clear reason for connecting`,
    userPromptTemplate: `Write a personalized LinkedIn connection request to {{displayName}} (username: {{username}}) based on their profile summary.

Profile Summary: {{summary}}
Company: {{companyName}}
Sender: {{senderName}}
Tone: {{tone}}

Focus on professional networking and mutual value. Be specific about their background and suggest reasons to connect. Use their real name "{{realName}}" in the message if available, not their username.`
  }
}

const TONE_MODIFIERS: Record<string, string> = {
  professional: 'Keep the tone strictly professional and formal',
  casual: 'Use a casual but respectful tone',
  friendly: 'Be warm and friendly while maintaining professionalism', 
  enthusiastic: 'Show genuine enthusiasm and energy',
  direct: 'Be direct and to-the-point without being rude'
}

/* ---------------------------------- *
 * Public Tool Parameters / Result
 * ---------------------------------- */

export interface EnhancedLinkedInSummary extends LinkedInSummaryResult {
  enrichment?: any
}

export interface GenerateOutreachToolParams {
  summaries: EnhancedLinkedInSummary[]
  messageTemplate?: string
  tone?: string
  companyName?: string
  senderName?: string
  customPrompt?: string
  maxMessages?: number
}

export interface OutreachMessage {
  username: string
  linkedin_summary: string
  outreach_message: string
  template: string
  tone: string
  generated_at: number
  real_name?: string
}

export interface GenerateOutreachToolResult {
  messages: OutreachMessage[]
  errors: {
    username: string
    code: string
    message: string
  }[]
  meta: {
    requested: number
    attempted: number
    succeeded: number
    failed: number
    template: string
    tone: string
    durationMs: number
  }
}

/* ---------------------------------- *
 * Helper Functions
 * ---------------------------------- */

function extractRealName(enrichmentData: any): string | null {
  if (!enrichmentData?.raw_text) return null
  
  // Try to extract real name from enrichment text using common patterns
  const text = enrichmentData.raw_text
  
  // Look for name patterns in Instagram bio enrichment
  const namePatterns = [
    /(?:I'm|I am|My name is|Name:)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*[\|•\-]/,
    /^([A-Z][a-z]+\s+[A-Z][a-z]+)/,
    /🌟\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
    /✨\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/
  ]
  
  for (const pattern of namePatterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      const name = match[1].trim()
      // Validate it looks like a real name (2-4 words, each starting with capital)
      if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}$/.test(name)) {
        return name
      }
    }
  }
  
  return null
}

function renderTemplate(template: string, variables: Record<string, string>): string {
  let rendered = template
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`{{${key}}}`, 'g')
    rendered = rendered.replace(placeholder, value || '')
  }
  return rendered
}

function debugLog(...args: any[]) {
  if (process.env.AGENT_DEBUG === '1') {
    // eslint-disable-next-line no-console
    console.log('[AGENT_OUTREACH]', ...args)
  }
}

/* ---------------------------------- *
 * Core Tool Implementation
 * ---------------------------------- */

export async function generateOutreachTool(params: GenerateOutreachToolParams): Promise<GenerateOutreachToolResult> {
  if (!params || !Array.isArray(params.summaries)) {
    throw new OutreachToolError('INVALID_PARAM', 'params.summaries must be an array')
  }
  
  if (params.summaries.length === 0) {
    throw new OutreachToolError('NO_SUMMARIES', 'No LinkedIn summaries provided')
  }

  const template = params.messageTemplate || 'generic_professional'
  const tone = params.tone || 'professional'
  const companyName = params.companyName || 'Our Company'
  const senderName = params.senderName || 'Our Team'
  
  let working: EnhancedLinkedInSummary[] = params.summaries
  if (typeof params.maxMessages === 'number' && params.maxMessages > 0 && working.length > params.maxMessages) {
    working = working.slice(0, params.maxMessages)
  }

  const messageTemplate = MESSAGE_TEMPLATES[template]
  if (!messageTemplate) {
    throw new OutreachToolError('INVALID_PARAM', `Unknown message template: ${template}`)
  }

  const toneModifier = TONE_MODIFIERS[tone] || TONE_MODIFIERS.professional

  const start = Date.now()
  const messages: OutreachMessage[] = []
  const errors: { username: string; code: string; message: string }[] = []

  for (const summary of working) {
    try {
      // Extract real name if available from enrichment data
      const realName = summary.enrichment ? extractRealName(summary.enrichment) : null
      const displayName = realName || summary.username
      
      console.log(`[DEBUG] Processing ${summary.username}: realName="${realName}", displayName="${displayName}"`)
      
      let systemPrompt = messageTemplate.systemPrompt
      let userPrompt: string

      if (params.customPrompt) {
        systemPrompt = params.customPrompt
        userPrompt = renderTemplate(params.customPrompt, {
          username: summary.username,
          realName: realName || summary.username,
          displayName,
          summary: summary.summary,
          companyName,
          senderName,
          tone
        })
      } else {
        systemPrompt += `\n\nAdditional tone guidance: ${toneModifier}`
        
        // If we have a real name, mention using it in the system prompt
        if (realName) {
          systemPrompt += `\n\nIMPORTANT: The person's real name is "${realName}" - use this in your message instead of their username "${summary.username}".`
        }
        
        userPrompt = renderTemplate(messageTemplate.userPromptTemplate, {
          username: summary.username,
          realName: realName || summary.username,
          displayName,
          summary: summary.summary,
          companyName,
          senderName,
          tone
        })
      }

      debugLog('generating_message', { username: summary.username, realName, template, tone })

      const result = await chatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], {
        temperature: 0.7,
        maxTokens: 300,
        timeoutMs: 15000,
        tag: 'outreach_generation'
      })

      const outreachMessage: OutreachMessage = {
        username: summary.username,
        linkedin_summary: summary.summary,
        outreach_message: result.text.trim(),
        template,
        tone,
        generated_at: Date.now(),
        real_name: realName || undefined
      }

      messages.push(outreachMessage)
      debugLog('message_generated', { username: summary.username, messageLength: result.text.length })

    } catch (err: any) {
      let errorCode = 'UNKNOWN'
      if (err instanceof LLMError) {
        errorCode = 'LLM_ERROR'
      }
      
      errors.push({
        username: summary.username,
        code: errorCode,
        message: err?.message || 'Unknown error during message generation'
      })
      
      debugLog('message_generation_failed', { username: summary.username, error: err?.message })
    }
  }

  const end = Date.now()
  return {
    messages,
    errors,
    meta: {
      requested: params.summaries.length,
      attempted: working.length,
      succeeded: messages.length,
      failed: errors.length,
      template,
      tone,
      durationMs: end - start
    }
  }
}

/* ---------------------------------- *
 * Agent Runner Wrapper
 * ---------------------------------- */

export interface GenerateOutreachAgentInput extends GenerateOutreachToolParams {
  stepId: string
}

export interface GenerateOutreachAgentOutput extends GenerateOutreachToolResult {
  stepId: string
}

export async function runGenerateOutreachAgent(input: GenerateOutreachAgentInput): Promise<GenerateOutreachAgentOutput> {
  const { stepId, ...toolParams } = input
  debugLog('start', { stepId, summaries: toolParams.summaries.length, template: toolParams.messageTemplate })
  const result = await generateOutreachTool(toolParams)
  debugLog('done', { stepId, succeeded: result.messages.length, failed: result.errors.length })
  return {
    stepId,
    ...result
  }
}

/* ---------------------------------- *
 * Template Management
 * ---------------------------------- */

export function getAvailableTemplates(): string[] {
  return Object.keys(MESSAGE_TEMPLATES)
}

export function getAvailableTones(): string[] {
  return Object.keys(TONE_MODIFIERS)
}

export function getTemplateInfo(templateName: string): MessageTemplate | undefined {
  return MESSAGE_TEMPLATES[templateName]
}