import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const prisma = new PrismaClient()

// Tool parameter schemas for validation
export const FindProfilesSchema = z.object({
  tags: z.array(z.string()).optional(),
  status: z.enum(['follower', 'following', 'pending', 'all']).optional(),
  event_history: z.string().optional(),
  limit: z.number().min(1).max(100).default(20)
})

export const AnalyzeChurnPatternsSchema = z.object({
  campaign_id: z.number()
})

export const GetCampaignPerformanceSchema = z.object({
  campaign_id: z.number()
})

export const InvokeProfileClassifierSchema = z.object({
  username: z.string()
})

export const SummarizeAndRecommendSchema = z.object({
  context: z.string(),
  data: z.array(z.any())
})

// Tool definitions with their schemas and functions
export interface SwarmTool {
  name: string
  description: string
  parameters: z.ZodSchema
  execute: (params: any) => Promise<any>
}

export const swarmTools: SwarmTool[] = [
  {
    name: 'find_profiles',
    description: 'Find profiles matching complex criteria including tags, follower status, and event history',
    parameters: FindProfilesSchema,
    execute: async (params) => {
      const { tags, status, event_history, limit } = params

      let whereClause: any = {}
      
      // Filter by status
      if (status === 'follower') {
        whereClause.is_active_follower = true
      } else if (status === 'following') {
        whereClause.is_currently_following = true
      } else if (status === 'pending') {
        whereClause.is_pending_outbound_request = true
      }

      // Filter by tags
      if (tags && tags.length > 0) {
        whereClause.tags = {
          some: {
            tag: {
              tag_name: {
                in: tags
              }
            }
          }
        }
      }

      const profiles = await prisma.profile.findMany({
        where: whereClause,
        include: {
          tags: {
            include: {
              tag: true
            }
          },
          interaction_events: {
            take: 5,
            orderBy: {
              event_ts: 'desc'
            }
          }
        },
        take: limit
      })

      return {
        count: profiles.length,
        profiles: profiles.map(profile => ({
          username: profile.current_username,
          profile_pk: profile.profile_pk,
          is_active_follower: profile.is_active_follower,
          is_currently_following: profile.is_currently_following,
          is_pending_outbound_request: profile.is_pending_outbound_request,
          tags: profile.tags.map(pt => pt.tag.tag_name),
          recent_events: profile.interaction_events.map(event => ({
            event_type: event.event_type,
            event_ts: event.event_ts
          }))
        }))
      }
    }
  },

  {
    name: 'analyze_churn_patterns',
    description: 'Identify common tags or attributes among users who unfollowed after a campaign',
    parameters: AnalyzeChurnPatternsSchema,
    execute: async (params) => {
      const { campaign_id } = params

      // Find users who followed during the campaign and later unfollowed
      const campaign = await prisma.campaign.findUnique({
        where: { campaign_id }
      })

      if (!campaign) {
        throw new Error('Campaign not found')
      }

      // Get profiles attributed to this campaign who later churned
      const churnedProfiles = await prisma.profile.findMany({
        where: {
          AND: [
            {
              interaction_events: {
                some: {
                  event_type: 'FOLLOWED_ME',
                  attribution: {
                    campaign_id: campaign_id
                  }
                }
              }
            },
            {
              interaction_events: {
                some: {
                  event_type: 'UNFOLLOWED_ME',
                  event_ts: {
                    gt: campaign.campaign_date
                  }
                }
              }
            }
          ]
        },
        include: {
          tags: {
            include: {
              tag: true
            }
          }
        }
      })

      // Analyze tag patterns
      const tagCounts: Record<string, number> = {}
      churnedProfiles.forEach(profile => {
        profile.tags.forEach(pt => {
          const tagName = pt.tag.tag_name
          tagCounts[tagName] = (tagCounts[tagName] || 0) + 1
        })
      })

      const sortedTags = Object.entries(tagCounts)
        .sort(([, a], [, b]) => b - a)
        .map(([tag, count]) => ({ tag, count }))

      return {
        total_churned: churnedProfiles.length,
        common_tags: sortedTags.slice(0, 10),
        churn_rate: churnedProfiles.length // Will be calculated against total attributed later
      }
    }
  },

  {
    name: 'get_campaign_performance',
    description: 'Calculate and return key metrics for a campaign including followers gained, churn rate, and attribution stats',
    parameters: GetCampaignPerformanceSchema,
    execute: async (params) => {
      const { campaign_id } = params

      const campaign = await prisma.campaign.findUnique({
        where: { campaign_id },
        include: {
          attributions: {
            include: {
              event: {
                include: {
                  profile: true
                }
              }
            }
          }
        }
      })

      if (!campaign) {
        throw new Error('Campaign not found')
      }

      const followEvents = campaign.attributions.filter(
        attr => attr.event.event_type === 'FOLLOWED_ME'
      )

      // Calculate churn rate
      const followedProfilePks = followEvents.map(attr => attr.event.profile_pk)
      const churnedCount = await prisma.interactionEvent.count({
        where: {
          profile_pk: { in: followedProfilePks },
          event_type: 'UNFOLLOWED_ME',
          event_ts: { gt: campaign.campaign_date }
        }
      })

      const churnRate = followEvents.length > 0 ? (churnedCount / followEvents.length) * 100 : 0

      return {
        campaign_name: campaign.campaign_name,
        campaign_date: campaign.campaign_date,
        campaign_type: campaign.campaign_type,
        total_attributions: campaign.attributions.length,
        followers_gained: followEvents.length,
        churned_followers: churnedCount,
        churn_rate: Math.round(churnRate * 100) / 100,
        net_growth: followEvents.length - churnedCount
      }
    }
  },

  {
    name: 'invoke_profile_classifier',
    description: 'Call the local Python service to get inferred tags for a specific user profile',
    parameters: InvokeProfileClassifierSchema,
    execute: async (params) => {
      const { username } = params

      try {
        const response = await fetch('http://localhost:5000/classify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ username }),
        })

        if (!response.ok) {
          throw new Error(`Classifier service error: ${response.statusText}`)
        }

        const result = await response.json()
        return {
          username,
          inferred_tags: result.tags || [],
          confidence_scores: result.confidence_scores || {},
          status: 'success'
        }
      } catch (error) {
        return {
          username,
          inferred_tags: [],
          confidence_scores: {},
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }
  },

  {
    name: 'summarize_and_recommend',
    description: 'Generate strategic recommendations and insights based on the context and analyzed data',
    parameters: SummarizeAndRecommendSchema,
    execute: async (params) => {
      const { context, data } = params

      // This is a placeholder for the final summary step
      // In a real implementation, this might call another LLM or use predefined logic
      let summary = `Based on the analysis of ${data.length} data points:\n\n`

      // Generate insights based on the data type and context
      if (context.includes('churn') || context.includes('unfollow')) {
        summary += '🔍 **Churn Analysis Insights:**\n'
        summary += '- Review the common tags among churned users to identify patterns\n'
        summary += '- Consider adjusting content strategy to better retain these user segments\n'
        summary += '- Monitor engagement rates of users with similar characteristics\n\n'
      }

      if (context.includes('campaign') || context.includes('performance')) {
        summary += '📈 **Campaign Performance Insights:**\n'
        summary += '- Track the conversion rate and quality of attributed followers\n'
        summary += '- Compare performance metrics across different campaign types\n'
        summary += '- Identify the most effective campaign strategies for future planning\n\n'
      }

      if (context.includes('audience') || context.includes('profile')) {
        summary += '👥 **Audience Insights:**\n'
        summary += '- Analyze demographic patterns in your follower base\n'
        summary += '- Identify high-value audience segments for targeted content\n'
        summary += '- Consider creating content that appeals to underrepresented segments\n\n'
      }

      summary += '🎯 **Next Best Actions:**\n'
      summary += '1. Review the data above and identify the most significant patterns\n'
      summary += '2. Create targeted content for high-value audience segments\n'
      summary += '3. Monitor ongoing trends and adjust strategy accordingly\n'
      summary += '4. Consider running follow-up campaigns based on these insights'

      return {
        summary,
        key_metrics: data.length,
        context,
        timestamp: new Date().toISOString()
      }
    }
  }
]

// Helper function to get tool by name
export function getToolByName(name: string): SwarmTool | undefined {
  return swarmTools.find(tool => tool.name === name)
}

// Helper function to get all tool definitions for LLM
export function getToolDefinitions() {
  return [
    {
      type: 'function',
      function: {
        name: 'find_profiles',
        description: 'Find profiles matching complex criteria including tags, follower status, and event history',
        parameters: {
          type: 'object',
          properties: {
            tags: { type: 'array', items: { type: 'string' }, description: 'Array of tag names to filter by' },
            status: { type: 'string', enum: ['follower', 'following', 'pending', 'all'], description: 'Follower status filter' },
            event_history: { type: 'string', description: 'Event history filter' },
            limit: { type: 'number', default: 20, description: 'Maximum number of profiles to return' }
          },
          required: []
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'analyze_churn_patterns',
        description: 'Identify common tags or attributes among users who unfollowed after a campaign',
        parameters: {
          type: 'object',
          properties: {
            campaign_id: { type: 'number', description: 'ID of the campaign to analyze' }
          },
          required: ['campaign_id']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_campaign_performance',
        description: 'Calculate and return key metrics for a campaign including followers gained, churn rate, and attribution stats',
        parameters: {
          type: 'object',
          properties: {
            campaign_id: { type: 'number', description: 'ID of the campaign to get performance for' }
          },
          required: ['campaign_id']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'invoke_profile_classifier',
        description: 'Call the local Python service to get inferred tags for a specific user profile',
        parameters: {
          type: 'object',
          properties: {
            username: { type: 'string', description: 'Username to classify' }
          },
          required: ['username']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'summarize_and_recommend',
        description: 'Generate strategic recommendations and insights based on the context and analyzed data',
        parameters: {
          type: 'object',
          properties: {
            context: { type: 'string', description: 'Context of the analysis' },
            data: { type: 'array', description: 'Array of data to summarize' }
          },
          required: ['context', 'data']
        }
      }
    }
  ]
}