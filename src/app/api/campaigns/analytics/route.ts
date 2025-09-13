import { prisma } from '../../../../lib/prisma'
import { jsonError, jsonSuccess } from '../../../../lib/api'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const campaignId = url.searchParams.get('campaignId')
    const dateRange = url.searchParams.get('dateRange') || '30' // days
    const timeZone = url.searchParams.get('timeZone') || 'UTC'

    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - parseInt(dateRange))

    if (campaignId) {
      // Single campaign analytics
      const campaign = await prisma.campaign.findUnique({
        where: { campaign_id: parseInt(campaignId) },
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
            },
            where: {
              event: {
                event_ts: {
                  gte: startDate,
                  lte: endDate
                }
              }
            }
          }
        }
      })

      if (!campaign) {
        return jsonError('Campaign not found', 404)
      }

      // Calculate metrics for this campaign
      const metrics = calculateCampaignMetrics(campaign)
      
      // Calculate tag-based insights
      const tagInsights = calculateTagInsights(campaign)
      
      return jsonSuccess({
        campaign: {
          campaign_id: campaign.campaign_id,
          campaign_name: campaign.campaign_name,
          campaign_date: campaign.campaign_date,
          campaign_type: campaign.campaign_type
        },
        metrics,
        tagInsights,
        timeRange: { startDate, endDate, days: parseInt(dateRange) }
      })
    } else {
      // All campaigns overview analytics
      const campaigns = await prisma.campaign.findMany({
        include: {
          attributions: {
            include: {
              event: {
                include: {
                  profile: true
                }
              }
            },
            where: {
              event: {
                event_ts: {
                  gte: startDate,
                  lte: endDate
                }
              }
            }
          }
        },
        orderBy: { campaign_date: 'desc' }
      })

      // Calculate metrics for all campaigns
      const campaignMetrics = campaigns.map((campaign: any) => ({
        campaign_id: campaign.campaign_id,
        campaign_name: campaign.campaign_name,
        campaign_date: campaign.campaign_date,
        campaign_type: campaign.campaign_type,
        metrics: calculateCampaignMetrics(campaign)
      }))

      // Calculate overall summary metrics
      const totalAttributions = campaigns.reduce((sum: number, c: any) => sum + c.attributions.length, 0)
      const totalFollowers = campaigns.reduce((sum: number, c: any) => {
        return sum + c.attributions.filter((a: any) => a.event.event_type === 'FOLLOWED_ME').length
      }, 0)
      const totalUnfollowers = campaigns.reduce((sum: number, c: any) => {
        return sum + c.attributions.filter((a: any) => a.event.event_type === 'UNFOLLOWED_ME').length
      }, 0)

      const summary = {
        totalCampaigns: campaigns.length,
        totalAttributions,
        totalFollowers,
        totalUnfollowers,
        netGrowth: totalFollowers - totalUnfollowers,
        conversionRate: totalAttributions > 0 ? (totalFollowers / totalAttributions) * 100 : 0
      }

      return jsonSuccess({
        summary,
        campaigns: campaignMetrics,
        timeRange: { startDate, endDate, days: parseInt(dateRange) }
      })
    }
  } catch (err: any) {
    return jsonError('Failed to fetch campaign analytics', 500, { detail: err?.message })
  }
}

function calculateCampaignMetrics(campaign: any) {
  const attributions = campaign.attributions || []
  
  // Basic counts
  const totalAttributions = attributions.length
  const followEvents = attributions.filter((a: any) => a.event.event_type === 'FOLLOWED_ME')
  const unfollowEvents = attributions.filter((a: any) => a.event.event_type === 'UNFOLLOWED_ME')
  
  const followers = followEvents.length
  const unfollowers = unfollowEvents.length
  const netGrowth = followers - unfollowers
  
  // Engagement metrics
  const conversionRate = totalAttributions > 0 ? (followers / totalAttributions) * 100 : 0
  const churnRate = followers > 0 ? (unfollowers / followers) * 100 : 0
  
  // Time-based analysis
  const dailyBreakdown = calculateDailyBreakdown(attributions)
  const peakEngagementDay = findPeakEngagementDay(dailyBreakdown)
  
  // Profile insights
  const uniqueProfiles = new Set(attributions.map((a: any) => a.event.profile_pk)).size
  const avgEventsPerProfile = uniqueProfiles > 0 ? totalAttributions / uniqueProfiles : 0
  
  return {
    totalAttributions,
    followers,
    unfollowers,
    netGrowth,
    conversionRate: Math.round(conversionRate * 100) / 100,
    churnRate: Math.round(churnRate * 100) / 100,
    uniqueProfiles,
    avgEventsPerProfile: Math.round(avgEventsPerProfile * 100) / 100,
    dailyBreakdown,
    peakEngagementDay
  }
}

function calculateDailyBreakdown(attributions: any[]) {
  const dailyData = new Map()
  
  attributions.forEach(attribution => {
    const date = new Date(attribution.event.event_ts).toISOString().split('T')[0]
    if (!dailyData.has(date)) {
      dailyData.set(date, { date, followers: 0, unfollowers: 0, total: 0 })
    }
    
    const dayData = dailyData.get(date)
    dayData.total++
    
    if (attribution.event.event_type === 'FOLLOWED_ME') {
      dayData.followers++
    } else if (attribution.event.event_type === 'UNFOLLOWED_ME') {
      dayData.unfollowers++
    }
  })
  
  return Array.from(dailyData.values()).sort((a, b) => a.date.localeCompare(b.date))
}

function findPeakEngagementDay(dailyBreakdown: any[]) {
  if (dailyBreakdown.length === 0) return null
  
  return dailyBreakdown.reduce((peak, current) => 
    current.total > peak.total ? current : peak
  )
}

function calculateTagInsights(campaign: any) {
  const attributions = campaign.attributions || []
  
  // Separate followers and churns
  const followers = attributions.filter((attr: any) => attr.event.event_type === 'FOLLOWED_ME')
  const churns = attributions.filter((attr: any) => attr.event.event_type === 'UNFOLLOWED_ME')
  
  // Extract all tags from followers and churns
  const followerTags = new Map()
  const churnTags = new Map()
  
  followers.forEach((attr: any) => {
    const profile = attr.event.profile
    if (profile.tags) {
      profile.tags.forEach((profileTag: any) => {
        const tagName = profileTag.tag.tag_name
        followerTags.set(tagName, (followerTags.get(tagName) || 0) + 1)
      })
    }
  })
  
  churns.forEach((attr: any) => {
    const profile = attr.event.profile
    if (profile.tags) {
      profile.tags.forEach((profileTag: any) => {
        const tagName = profileTag.tag.tag_name
        churnTags.set(tagName, (churnTags.get(tagName) || 0) + 1)
      })
    }
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
  
  // Generate top 3 key stats
  const topStats = []
  
  // Top follower tag
  if (followerTagStats.length > 0) {
    const topFollowerTag = followerTagStats[0]
    topStats.push({
      value: `${topFollowerTag.percentage}%`,
      label: `Had the '${topFollowerTag.tag}' tag`,
      type: 'followers',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    })
  }
  
  // Top churn tag
  if (churnTagStats.length > 0) {
    const topChurnTag = churnTagStats[0]
    topStats.push({
      value: `${topChurnTag.percentage}%`,
      label: `Had the '${topChurnTag.tag}' tag`,
      type: 'churns',
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200'
    })
  }
  
  // Net growth or conversion rate
  const netGrowth = totalFollowers - totalChurns
  if (netGrowth !== 0) {
    topStats.push({
      value: `${netGrowth > 0 ? '+' : ''}${netGrowth}`,
      label: 'Net Growth',
      type: 'growth',
      color: netGrowth > 0 ? 'text-green-600' : 'text-red-600',
      bgColor: netGrowth > 0 ? 'bg-green-50' : 'bg-red-50',
      borderColor: netGrowth > 0 ? 'border-green-200' : 'border-red-200'
    })
  }
  
  // Generate generalizations
  const generalizations = []
  
  if (followerTagStats.length > 0) {
    const topTag = followerTagStats[0]
    if (topTag.percentage > 50) {
      generalizations.push(`Your followers like the ${topTag.tag} content, post more.`)
    }
  }
  
  if (churnTagStats.length > 0) {
    const topChurnTag = churnTagStats[0]
    if (topChurnTag.percentage > 30) {
      generalizations.push(`Many people with '${topChurnTag.tag}' tag unfollowed - consider adjusting content strategy.`)
    }
  }
  
  if (netGrowth > 0) {
    generalizations.push(`Your campaign gained ${totalFollowers} new followers with strong engagement.`)
  } else if (netGrowth < 0) {
    generalizations.push(`Your campaign lost ${Math.abs(netGrowth)} followers - review content strategy.`)
  }
  
  return {
    topStats: topStats.slice(0, 3), // Top 3 stats
    generalizations,
    followerTagStats,
    churnTagStats,
    totalFollowers,
    totalChurns
  }
}