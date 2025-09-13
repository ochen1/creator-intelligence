import { prisma } from '../../../../../lib/prisma'
import { jsonError, jsonSuccess, safeJson } from '../../../../../lib/api'

type ProfileTagBody = {
  tagId?: unknown
}

// POST /api/profiles/[username]/tags - Add a tag to a profile
export async function POST(
  request: Request,
  context: { params: Promise<{ username: string }> },
) {
  const params = await context.params
  const username = params?.username
  if (!username || !username.trim()) {
    return jsonError('username parameter required', 400)
  }

  const parsed = await safeJson<ProfileTagBody>(request)
  if (!parsed.ok) return parsed.response

  const body = parsed.value

  if (body.tagId === undefined || body.tagId === null) {
    return jsonError('tagId is required')
  }

  const tagId = Number(body.tagId)
  if (!Number.isInteger(tagId) || tagId <= 0) {
    return jsonError('tagId must be a positive integer')
  }

  try {
    // Check if profile exists
    const profile = await prisma.profile.findUnique({
      where: { current_username: username },
      select: { profile_pk: true },
    })

    if (!profile) {
      return jsonError('Profile not found', 404)
    }

    // Check if tag exists
    const tag = await prisma.tag.findUnique({
      where: { tag_id: tagId },
      select: { tag_id: true },
    })

    if (!tag) {
      return jsonError('Tag not found', 404)
    }

    // Check if association already exists
    const existing = await prisma.profileTag.findUnique({
      where: {
        profile_pk_tag_id: {
          profile_pk: profile.profile_pk,
          tag_id: tagId,
        },
      },
    })

    if (existing) {
      return jsonError('Profile already has this tag', 409)
    }

    // Create the association
    const created = await prisma.profileTag.create({
      data: {
        profile_pk: profile.profile_pk,
        tag_id: tagId,
      },
      include: {
        tag: true,
      },
    })

    return jsonSuccess(created, undefined, { status: 201 })
  } catch (err: any) {
    return jsonError('Failed to add tag to profile', 500, { detail: err?.message })
  }
}

// DELETE /api/profiles/[username]/tags - Remove a tag from a profile
export async function DELETE(
  request: Request,
  context: { params: Promise<{ username: string }> },
) {
  const params = await context.params
  const username = params?.username
  if (!username || !username.trim()) {
    return jsonError('username parameter required', 400)
  }

  const parsed = await safeJson<ProfileTagBody>(request)
  if (!parsed.ok) return parsed.response

  const body = parsed.value

  if (body.tagId === undefined || body.tagId === null) {
    return jsonError('tagId is required')
  }

  const tagId = Number(body.tagId)
  if (!Number.isInteger(tagId) || tagId <= 0) {
    return jsonError('tagId must be a positive integer')
  }

  try {
    // Check if profile exists
    const profile = await prisma.profile.findUnique({
      where: { current_username: username },
      select: { profile_pk: true },
    })

    if (!profile) {
      return jsonError('Profile not found', 404)
    }

    // Check if association exists
    const existing = await prisma.profileTag.findUnique({
      where: {
        profile_pk_tag_id: {
          profile_pk: profile.profile_pk,
          tag_id: tagId,
        },
      },
    })

    if (!existing) {
      return jsonError('Profile does not have this tag', 404)
    }

    // Remove the association
    await prisma.profileTag.delete({
      where: {
        profile_pk_tag_id: {
          profile_pk: profile.profile_pk,
          tag_id: tagId,
        },
      },
    })

    return jsonSuccess({
      message: 'Tag removed from profile',
      profile_pk: profile.profile_pk,
      tag_id: tagId,
    })
  } catch (err: any) {
    return jsonError('Failed to remove tag from profile', 500, { detail: err?.message })
  }
}