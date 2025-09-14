import { prisma } from '../../../../../lib/prisma'
import { jsonError, jsonSuccess } from '../../../../../lib/api'

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const campaignId = parseInt(id)

    if (isNaN(campaignId)) {
      return jsonError('Invalid campaign ID', 400)
    }

    // Get campaign with attributions and related profile data
    const campaign = await prisma.campaign.findUnique({
      where: { campaign_id: campaignId },
      include: {
        attributions: {
          include: {
            event: {
              include: {
                profile: {
                  include: {
                    tags: {
                      include: {
                        tag: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!campaign) {
      return jsonError('Campaign not found', 404)
    }

    // Separate followers and churns
    const followers = campaign.attributions.filter(attr => attr.event.event_type === 'FOLLOWED_ME')
    const churns = campaign.attributions.filter(attr => attr.event.event_type === 'UNFOLLOWED_ME')

    // Extract tags from followers and churns
    const followerTags = new Map<string, number>()
    const churnTags = new Map<string, number>()

    followers.forEach(attr => {
      const profile = attr.event.profile
      profile.tags.forEach(profileTag => {
        const tagName = profileTag.tag.tag_name
        followerTags.set(tagName, (followerTags.get(tagName) || 0) + 1)
      })
    })

    churns.forEach(attr => {
      const profile = attr.event.profile
      profile.tags.forEach(profileTag => {
        const tagName = profileTag.tag.tag_name
        churnTags.set(tagName, (churnTags.get(tagName) || 0) + 1)
      })
    })

    // Calculate tag percentages
    const totalFollowers = followers.length
    const totalChurns = churns.length

    const followerTagStats = Array.from(followerTags.entries()).map(([tagName, count]) => ({
      tag: tagName,
      count,
      percentage: totalFollowers > 0 ? Math.round((count / totalFollowers) * 100) : 0
    })).sort((a, b) => b.percentage - a.percentage)

    const churnTagStats = Array.from(churnTags.entries()).map(([tagName, count]) => ({
      tag: tagName,
      count,
      percentage: totalChurns > 0 ? Math.round((count / totalChurns) * 100) : 0
    })).sort((a, b) => b.percentage - a.percentage)

    return jsonSuccess({
      campaign: {
        campaign_id: campaign.campaign_id,
        campaign_name: campaign.campaign_name,
        campaign_date: campaign.campaign_date,
        campaign_type: campaign.campaign_type
      },
      followerTags: followerTagStats,
      churnTags: churnTagStats,
      totalFollowers,
      totalChurns,
      netGrowth: totalFollowers - totalChurns
    })

  } catch (err: any) {
    console.error('Error fetching campaign analytics:', err)
    return jsonError('Failed to fetch campaign analytics', 500, { detail: err?.message })
  }
}
