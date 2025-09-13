import { prisma } from '../../../lib/prisma'
import { jsonError, jsonSuccess, safeJson } from '../../../lib/api'
import { EventType } from '@prisma/client'

/**
 * Body structure:
 * {
 *   followers_1_json: string (raw JSON text of followers_1.json)
 *   following_json: string (raw JSON text of following.json)
 *   pending_follow_requests_json: string (raw JSON text)
 *   original_zip_filename: string (e.g. instagram-username-2025-06-13-random.zip)
 * }
 */

type IngestBody = {
  followers_1_json?: string
  following_json?: string
  pending_follow_requests_json?: string
  original_zip_filename?: string
}


function extractDateFromFilename(name: string): string | null {
  // pattern: instagram-username-YYYY-MM-DD
  const parts = name.split('-')
  if (parts.length < 4) return null
  // last segment before random hash might include date; search for pattern
  const datePattern = /\d{4}-\d{2}-\d{2}/
  const match = name.match(datePattern)
  if (!match) return null
  return match[0]
}

interface RawFollowerEntry {
  string_list_data?: { href: string; value: string; timestamp?: number }[]
}

interface RelationshipsWrapper {
  relationships_following?: RawFollowerEntry[]
  relationships_follow_requests_sent?: RawFollowerEntry[]
}

/**
 * New behavior:
 * - Each parser returns a Map<username, timestampMs | null>
 * - If multiple entries exist for the same username the latest timestamp is used.
 */
function parseFollowers1(raw: string): Map<string, number | null> {
  const arr = JSON.parse(raw) as RawFollowerEntry[]
  const map = new Map<string, number | null>()
  for (const entry of arr) {
    const items = entry.string_list_data || []
    for (const s of items) {
      if (s?.value) {
        const uname = s.value.trim()
        const tsMs = typeof s.timestamp === 'number' ? s.timestamp * 1000 : null
        const existing = map.get(uname) ?? null
        if (tsMs && existing) {
          if (tsMs > existing) map.set(uname, tsMs)
        } else {
          // set either tsMs (may be null) or existing (if present)
          map.set(uname, tsMs ?? (existing ?? null))
        }
      }
    }
  }
  return map
}

function parseFollowing(raw: string): Map<string, number | null> {
  const obj = JSON.parse(raw) as RelationshipsWrapper
  const list = obj.relationships_following || []
  const map = new Map<string, number | null>()
  for (const entry of list) {
    const items = entry.string_list_data || []
    for (const s of items) {
      if (s?.value) {
        const uname = s.value.trim()
        const tsMs = typeof s.timestamp === 'number' ? s.timestamp * 1000 : null
        const existing = map.get(uname) ?? null
        if (tsMs && existing) {
          if (tsMs > existing) map.set(uname, tsMs)
        } else {
          map.set(uname, tsMs ?? (existing ?? null))
        }
      }
    }
  }
  return map
}

function parsePending(raw: string): Map<string, number | null> {
  const obj = JSON.parse(raw) as RelationshipsWrapper
  const list = obj.relationships_follow_requests_sent || []
  const map = new Map<string, number | null>()
  for (const entry of list) {
    const items = entry.string_list_data || []
    for (const s of items) {
      if (s?.value) {
        const uname = s.value.trim()
        const tsMs = typeof s.timestamp === 'number' ? s.timestamp * 1000 : null
        const existing = map.get(uname) ?? null
        if (tsMs && existing) {
          if (tsMs > existing) map.set(uname, tsMs)
        } else {
          map.set(uname, tsMs ?? (existing ?? null))
        }
      }
    }
  }
  return map
}

export async function POST(request: Request) {
  const parsed = await safeJson<IngestBody>(request)
  if (!parsed.ok) return parsed.response

  const body = parsed.value

  const {
    followers_1_json,
    following_json,
    pending_follow_requests_json,
    original_zip_filename,
  } = body

  if (
    !followers_1_json ||
    !following_json ||
    !pending_follow_requests_json ||
    !original_zip_filename
  ) {
    return jsonError(
      'followers_1_json, following_json, pending_follow_requests_json, original_zip_filename are required',
    )
  }

  const snapshotDate = extractDateFromFilename(original_zip_filename)
  if (!snapshotDate) {
    return jsonError('Could not parse date from original_zip_filename', 400, {
      filename: original_zip_filename,
    })
  }

  try {
    // Step 2: Snapshot Check
    const existing = await prisma.snapshot.findUnique({
      where: { snapshot_date: snapshotDate },
    })
    if (existing) {
      return jsonError(
        'Snapshot for this date already processed',
        409,
        { snapshot_date: snapshotDate },
      )
    }

    // Step 3: Data Parsing
    let followersMap = new Map<string, number | null>()
    let followingMap = new Map<string, number | null>()
    let pendingMap = new Map<string, number | null>()

    try {
      followersMap = parseFollowers1(followers_1_json)
      followingMap = parseFollowing(following_json)
      pendingMap = parsePending(pending_follow_requests_json)
    } catch (err: any) {
      return jsonError('Failed to parse one of the JSON payloads', 400, {
        detail: err?.message,
      })
    }

    // Build username arrays from map keys
    let followers = Array.from(followersMap.keys())
    let following = Array.from(followingMap.keys())
    let pending = Array.from(pendingMap.keys())

    // Normalize usernames (trim, lower?) - assuming case-sensitive handle, we just trim.
    const norm = (u: string) => u.trim()
    followers = followers.map(norm)
    following = following.map(norm)
    pending = pending.map(norm)

    // Collect all unique usernames
    const allUsernames = Array.from(
      new Set([...followers, ...following, ...pending]),
    )

    // Helper: determine a sane timestamp (Date) from ms or null
    const now = new Date()
    const earliestSane = new Date('2010-01-01').getTime()
    const latestSane = now.getTime() + 24 * 3600 * 1000 // allow 1 day future slack

    function getSaneDateFromMs(ms: number | null | undefined): Date | null {
      if (!ms) return null
      if (ms >= earliestSane && ms <= latestSane) return new Date(ms)
      return null
    }

    const snapshotDateObj = (() => {
      // Use snapshot date (YYYY-MM-DD) as fallback timestamp for absence-driven events
      const d = new Date(snapshotDate)
      if (!isNaN(d.getTime())) return d
      return null
    })()

    // Step 4-9 Transaction with extended timeout
    const resultSummary = await prisma.$transaction(async (tx) => {
      // Step 5: Ensure Profiles exist (batch creation for efficiency)
      const existingProfiles = await tx.profile.findMany({
        where: { current_username: { in: allUsernames } },
        select: { current_username: true }
      })
      
      const existingUsernames = new Set(existingProfiles.map(p => p.current_username))
      const newUsernames = allUsernames.filter(u => u && !existingUsernames.has(u))
      
      if (newUsernames.length > 0) {
        await tx.profile.createMany({
          data: newUsernames.map(username => ({
            current_username: username,
          }))
        })
      }

      // Step 6: Fetch relevant profiles
      const relevantProfiles = await tx.profile.findMany({
        where: {
          OR: [
            { current_username: { in: allUsernames } },
            { is_active_follower: true },
            { is_currently_following: true },
            { is_pending_outbound_request: true },
          ],
        },
        select: {
          profile_pk: true,
          current_username: true,
          is_active_follower: true,
          is_currently_following: true,
          is_pending_outbound_request: true,
        },
      })

      // Index by username for quick lookup
      const byUsername = new Map(
        relevantProfiles.map((p) => [p.current_username, p]),
      )

      // Prepare event creations and flag updates
      const eventCreates: {
        profile_pk: number
        event_type: EventType
        event_ts: Date
      }[] = []
      const profileUpdates: {
        profile_pk: number
        data: {
          is_active_follower?: boolean
          is_currently_following?: boolean
          is_pending_outbound_request?: boolean
        }
      }[] = []

      // Utility to schedule update merges
      function scheduleFlagUpdate(
        profile_pk: number,
        partial: {
          is_active_follower?: boolean
          is_currently_following?: boolean
          is_pending_outbound_request?: boolean
        },
      ) {
        const existing = profileUpdates.find((u) => u.profile_pk === profile_pk)
        if (existing) {
          existing.data = { ...existing.data, ...partial }
        } else {
          profileUpdates.push({ profile_pk, data: { ...partial } })
        }
      }

      // Convert arrays to sets for diffing
      const followersSet = new Set(followers)
      const followingSet = new Set(following)
      const pendingSet = new Set(pending)

      // Process each relevant profile
      for (const p of relevantProfiles) {
        const username = p.current_username

        // Determine per-event timestamp helpers:
        // - For presence-driven events, prefer JSON timestamp for that category
        // - For absence-driven events, fall back to snapshotDateObj then now
        function tsForPresence(categoryMap: Map<string, number | null> | undefined) {
          const ms = categoryMap?.get(username) ?? null
          const sane = getSaneDateFromMs(ms)
          return sane ?? snapshotDateObj ?? now
        }
        function tsForAbsence() {
          return snapshotDateObj ?? now
        }

        // FR-1.3.1: Inbound Followers
        const isNowFollower = followersSet.has(username)
        if (isNowFollower && !p.is_active_follower) {
          eventCreates.push({
            profile_pk: p.profile_pk,
            event_type: 'FOLLOWED_ME',
            event_ts: tsForPresence(followersMap),
          })
          scheduleFlagUpdate(p.profile_pk, { is_active_follower: true })
        } else if (!isNowFollower && p.is_active_follower) {
          eventCreates.push({
            profile_pk: p.profile_pk,
            event_type: 'UNFOLLOWED_ME',
            event_ts: tsForAbsence(),
          })
          scheduleFlagUpdate(p.profile_pk, { is_active_follower: false })
        }

        // FR-1.3.2: Outbound Following
        const isNowFollowing = followingSet.has(username)
        if (isNowFollowing && !p.is_currently_following) {
          eventCreates.push({
            profile_pk: p.profile_pk,
            event_type: 'I_FOLLOWED',
            event_ts: tsForPresence(followingMap),
          })
          scheduleFlagUpdate(p.profile_pk, {
            is_currently_following: true,
            is_pending_outbound_request: false,
          })
        } else if (!isNowFollowing && p.is_currently_following) {
          eventCreates.push({
            profile_pk: p.profile_pk,
            event_type: 'I_UNFOLLOWED',
            event_ts: tsForAbsence(),
          })
          scheduleFlagUpdate(p.profile_pk, { is_currently_following: false })
        }

        // FR-1.3.3: Pending Outbound Requests
        const isNowPending = pendingSet.has(username)
        if (isNowPending && !p.is_pending_outbound_request && !isNowFollowing) {
          eventCreates.push({
            profile_pk: p.profile_pk,
            event_type: 'FOLLOW_REQUEST_SENT',
            event_ts: tsForPresence(pendingMap),
          })
          scheduleFlagUpdate(p.profile_pk, {
            is_pending_outbound_request: true,
          })
        } else if (
          !isNowPending &&
          p.is_pending_outbound_request &&
          !isNowFollowing
        ) {
          // Pending request withdrawn/rejected
            eventCreates.push({
              profile_pk: p.profile_pk,
              event_type: 'PENDING_REQUEST_CANCELLED',
              event_ts: tsForAbsence(),
            })
            scheduleFlagUpdate(p.profile_pk, {
              is_pending_outbound_request: false,
            })
        }
      }

      // Persist events
      if (eventCreates.length > 0) {
        await tx.interactionEvent.createMany({
          data: eventCreates,
        })
      }

      // Persist profile flag updates in batches to avoid timeout
      const batchSize = 50
      for (let i = 0; i < profileUpdates.length; i += batchSize) {
        const batch = profileUpdates.slice(i, i + batchSize)
        await Promise.all(
          batch.map(upd =>
            tx.profile.update({
              where: { profile_pk: upd.profile_pk },
              data: upd.data,
            })
          )
        )
      }

      // Record snapshot
      await tx.snapshot.create({
        data: {
          snapshot_date: snapshotDate,
        },
      })

      return {
        snapshot_date: snapshotDate,
        new_profiles: allUsernames.length,
        total_events_created: eventCreates.length,
        event_breakdown: eventCreates.reduce(
          (acc, e) => {
            acc[e.event_type] = (acc[e.event_type] || 0) + 1
            return acc
          },
          {} as Record<string, number>,
        ),
        profile_updates: profileUpdates.length,
      }
    }, {
      timeout: 30000, // 30 second timeout instead of default 5 seconds
    })

    return jsonSuccess(resultSummary)
  } catch (err: any) {
    return jsonError('Failed to ingest snapshot', 500, { detail: err?.message })
  }
}