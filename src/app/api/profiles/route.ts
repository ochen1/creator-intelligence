import { prisma } from '../../../lib/prisma'
import { jsonError, jsonSuccess, paginationMeta } from '../../../lib/api'

/**
 * Query parameters:
 *  - search: string (matches current_username or historical usernames)
 *  - status: one of (All|Follower|Following|Mutual|Pending|None) - case insensitive
 *  - page: 1-based page number (default 1)
 *  - pageSize: items per page (default 20, max 100)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const rawSearch = searchParams.get('search')?.trim() || ''
    const rawStatus = (searchParams.get('status') || 'All').toLowerCase()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10) || 20),
    )

    // Build base where clause
    const where: any = {}

    // Search filter (SQLite does not support case-insensitive `mode` argument on string filters)
    // NOTE: This will be case-sensitive. For true case-insensitive search we could:
    //  - Add a lowercase shadow column and store lowercase usernames, OR
    //  - Switch to a provider that supports `mode: 'insensitive'`.
    if (rawSearch) {
      where.OR = [
        {
          current_username: {
            contains: rawSearch,
          },
        },
        {
          username_history: {
            some: {
              username: {
                contains: rawSearch,
              },
            },
          },
        },
      ]
    }

    // Status filter mapping (semantic definitions):
    // follower  = they follow me AND I do NOT follow them back
    // following = I follow them AND they do NOT follow me back
    // mutual    = both follow each other
    // pending   = I have an outstanding follow request
    // none      = all flags false
    switch (rawStatus) {
      case 'follower':
        where.is_active_follower = true
        where.is_currently_following = false
        break
      case 'following':
        where.is_currently_following = true
        where.is_active_follower = false
        break
      case 'mutual':
        where.is_active_follower = true
        where.is_currently_following = true
        break
      case 'pending':
        where.is_pending_outbound_request = true
        break
      case 'none':
        where.is_active_follower = false
        where.is_currently_following = false
        where.is_pending_outbound_request = false
        break
      case 'all':
      default:
        break
    }

    const skip = (page - 1) * pageSize

    const [total, profiles] = await Promise.all([
      prisma.profile.count({ where }),
      prisma.profile.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { profile_pk: 'asc' },
        select: {
          profile_pk: true,
          current_username: true,
          first_seen_ts: true,
          notes: true,
          is_active_follower: true,
          is_currently_following: true,
          is_pending_outbound_request: true,
        },
      }),
    ])

    const paginationData = paginationMeta(page, pageSize, total)
    
    return jsonSuccess({
      data: profiles,
      total,
      page,
      pageSize,
      totalPages: paginationData.totalPages
    }, {
      pagination: paginationData,
      filters: {
        search: rawSearch || null,
        status: rawStatus,
      },
    })
  } catch (err: any) {
    return jsonError('Failed to fetch profiles', 500, { detail: err?.message })
  }
}