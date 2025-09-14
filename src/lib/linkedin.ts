/**
 * LinkedIn Research Client
 * 
 * Provides a thin, typed wrapper around the LinkedIn summary API.
 * Endpoint: http://localhost:40209/summary?username=<name>&tags=<tags>
 * Returns: { username: string, tags: string, summary: string }
 *
 * Responsibilities:
 *  - Provide a thin, typed wrapper around the LinkedIn summary API
 *  - Enforce a timeout (default 10s) and a single retry on network / 5xx errors
 *  - Normalize errors into LinkedInError with a clear code
 *  - Optional debug logging when AGENT_DEBUG=1
 *
 * Non-responsibilities:
 *  - Caching (explicitly disabled per spec)
 *  - Rate limiting (none required)
 *  - Circuit breaking (not required for hackathon scope)
 */

export interface ProfileIdentificationResult {
  name: string
  handle: string
  status: string
  stats: {
    posts: number
    following: number
    followers: number
  }
  bio: string
  labels: string[]
  data: string
}

export interface LinkedInSummaryResult {
  username: string
  real_name?: string
  tags: string
  summary: string
  bio?: string
  labels?: string[]
  /**
   * Timestamp (ms) when fetched (added locally for downstream correlation / ordering)
   */
  fetched_at: number
}

export interface LinkedInClientOptions {
  baseUrl?: string
  timeoutMs?: number
  retry?: boolean
}

export type LinkedInErrorCode =
  | 'NETWORK'
  | 'TIMEOUT'
  | 'BAD_STATUS'
  | 'INVALID_JSON'
  | 'INVALID_SHAPE'
  | 'UNKNOWN'

export class LinkedInError extends Error {
  public code: LinkedInErrorCode
  public status?: number
  public causeError?: unknown

  constructor(code: LinkedInErrorCode, message: string, opts?: { status?: number; cause?: unknown }) {
    super(message)
    this.name = 'LinkedInError'
    this.code = code
    this.status = opts?.status
    this.causeError = opts?.cause
  }
}

const DEFAULT_BASE = 'https://7005d0347fac.ngrok-free.app'
const DEFAULT_TIMEOUT = 10000
const PROFILE_IDENTIFICATION_ENDPOINT = '/get-user-info'

interface InternalFetchAttemptParams {
  url: string
  timeoutMs: number
  attempt: number
  maxAttempts: number
  method?: string
  body?: string
  headers?: Record<string, string>
}

/**
 * Perform a single fetch attempt with timeout using AbortController.
 */
async function fetchWithTimeout(params: InternalFetchAttemptParams): Promise<Response> {
  const { url, timeoutMs, method = 'GET', body, headers = {} } = params
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        ...headers,
      },
      body,
      cache: 'no-store',
    })
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new LinkedInError('TIMEOUT', `LinkedIn request timed out after ${timeoutMs}ms`, { cause: err })
    }
    throw new LinkedInError('NETWORK', 'Network error during LinkedIn fetch', { cause: err })
  } finally {
    clearTimeout(timer)
  }
}

function debugLog(...args: any[]) {
  if (process.env.AGENT_DEBUG === '1') {
    // eslint-disable-next-line no-console
    console.debug('[agent][linkedin]', ...args)
  }
}

/**
 * Fetch LinkedIn summary for a single username with optional tags.
 * Retries once (total attempts = 2) on:
 *   - NETWORK
 *   - TIMEOUT
 *   - 5xx status
 */
export async function fetchLinkedInSummary(
  username: string,
  tags?: string | string[],
  opts: LinkedInClientOptions = {},
): Promise<LinkedInSummaryResult> {
  if (!username || typeof username !== 'string') {
    throw new LinkedInError('INVALID_SHAPE', 'Username must be a non-empty string')
  }

  const baseUrl = (opts.baseUrl || DEFAULT_BASE).replace(/\/+$/, '')
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT
  const maxAttempts = opts.retry === false ? 1 : 2

  // Build URL with query parameters
  const url = new URL(`${baseUrl}/summary`)
  url.searchParams.set('username', username)
  
  if (tags) {
    const tagsString = Array.isArray(tags) ? tags.join(',') : tags
    if (tagsString.trim()) {
      url.searchParams.set('tags', tagsString.trim())
    }
  }

  let lastError: LinkedInError | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const attemptLabel = `${attempt}/${maxAttempts}`
    try {
      console.log(`[DEBUG] Attempting LinkedIn fetch`, { username, tags, url: url.toString(), attempt: attemptLabel })

      const res = await fetchWithTimeout({
        url: url.toString(),
        timeoutMs,
        attempt,
        maxAttempts,
      })
      
      console.log(`[DEBUG] LinkedIn API response status: ${res.status}`)

      if (!res.ok) {
        // Retry logic: only retry on 5xx for status-based errors
        if (res.status >= 500 && res.status < 600 && attempt < maxAttempts) {
          lastError = new LinkedInError('BAD_STATUS', `Server error status=${res.status}`, { status: res.status })
          debugLog(`Retrying after server error`, { status: res.status, attempt: attemptLabel })
          continue
        }
        throw new LinkedInError('BAD_STATUS', `Unexpected status ${res.status}`, { status: res.status })
      }

      let json: any
      try {
        json = await res.json()
      } catch (err: any) {
        throw new LinkedInError('INVALID_JSON', 'Failed to parse JSON', { cause: err })
      }

      if (!json || typeof json !== 'object') {
        throw new LinkedInError('INVALID_SHAPE', 'Response is not an object')
      }
      
      // The API returns { data: "content string" } format
      if (typeof json.data !== 'string') {
        throw new LinkedInError(
          'INVALID_SHAPE',
          'Response missing required field { data: string }',
        )
      }

      const result: LinkedInSummaryResult = {
        username: username,
        tags: tags ? (Array.isArray(tags) ? tags.join(',') : tags) : '',
        summary: json.data, // The content is in the "data" field
        fetched_at: Date.now(),
      }

      debugLog(`LinkedIn summary success`, { username, summaryLength: result.summary.length, tags: result.tags })
      return result
    } catch (err: any) {
      if (!(err instanceof LinkedInError)) {
        lastError = new LinkedInError('UNKNOWN', 'Unknown LinkedIn error', { cause: err })
      } else {
        lastError = err
      }

      console.log(`[DEBUG] LinkedIn fetch error:`, {
        code: lastError.code,
        message: lastError.message,
        username,
        attempt: attemptLabel,
        cause: err?.message
      })

      // Retry only for specific transient codes
      const retryable = ['NETWORK', 'TIMEOUT'].includes(lastError.code)
      if (retryable && attempt < maxAttempts) {
        console.log(`[DEBUG] Retrying LinkedIn fetch`, { code: lastError.code, attempt: attemptLabel })
        continue
      }
      // Non-retryable or last attempt
      console.log(`[DEBUG] LinkedIn fetch failed permanently`, { code: lastError.code, message: lastError.message })
      throw lastError
    }
  }

  // Should never reach here because loop either returns or throws
  throw lastError ?? new LinkedInError('UNKNOWN', 'Exhausted attempts with unknown error')
}

/**
 * Bulk helper: sequentially fetch LinkedIn summaries for multiple usernames.
 * Current spec: no concurrency/limit enforcement needed, but structure allows future extension.
 */
export async function fetchManyLinkedInSummaries(
  usernames: string[], 
  tags?: string | string[], 
  opts?: LinkedInClientOptions
): Promise<LinkedInSummaryResult[]> {
  const results: LinkedInSummaryResult[] = []
  for (const u of usernames) {
    try {
      const r = await fetchLinkedInSummary(u, tags, opts)
      results.push(r)
    } catch (err) {
      debugLog(`Skipping LinkedIn summary for username due to error`, { username: u, error: (err as any)?.message })
      // Decide policy: swallow errors for individual summaries to allow partial success
      // Could push a placeholder entry or annotate an error array if desired.
    }
  }
  return results
}

/**
 * Helper to normalize tags from various sources
 */
export function normalizeTags(tags?: string | string[] | null): string {
  if (!tags) return ''
  if (Array.isArray(tags)) {
    return tags.filter(t => t && typeof t === 'string').join(',')
  }
  return String(tags).trim()
}