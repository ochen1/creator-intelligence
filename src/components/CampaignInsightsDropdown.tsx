'use client'

import { useState } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useCampaignAnalytics } from '@/lib/hooks'
import { formatDate } from '@/lib/dates'
import { TrendingUp, TrendingDown, Users, UserMinus, BarChart3, Calendar, Target, Eye, ChevronRight } from 'lucide-react'

interface CampaignInsightsDropdownProps {
  campaignId: number
  campaignName: string
  children: React.ReactNode
  onExpandedChange?: (isExpanded: boolean) => void
}

export function CampaignInsightsDropdown({ campaignId, campaignName, children, onExpandedChange }: CampaignInsightsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    onExpandedChange?.(open)
  }
  const [dateRange, setDateRange] = useState('30')
  const [activeTab, setActiveTab] = useState<'follows' | 'churns'>('follows')
  
  const { data: analytics, isLoading } = useCampaignAnalytics({
    campaignId: campaignId,
    dateRange: parseInt(dateRange)
  })

  const campaign = analytics?.campaign
  const metrics = analytics?.metrics
  const tagInsights = analytics?.tagInsights

  // Get actual followers and churns data
  const getFollowersAndChurns = () => {
    if (!analytics?.campaign?.attributions) return { followers: [], churns: [] }
    
    const followers = analytics.campaign.attributions
      .filter((attr: any) => attr.event.event_type === 'FOLLOWED_ME')
      .map((attr: any) => ({
        username: attr.event.profile.current_username,
        date: attr.event.event_ts,
        profile_pk: attr.event.profile_pk
      }))
    
    const churns = analytics.campaign.attributions
      .filter((attr: any) => attr.event.event_type === 'UNFOLLOWED_ME')
      .map((attr: any) => ({
        username: attr.event.profile.current_username,
        date: attr.event.event_ts,
        profile_pk: attr.event.profile_pk
      }))
    
    return { followers, churns }
  }

  // Generate top 3 key stats dynamically
  const generateTop3Stats = () => {
    if (!metrics) return []
    
    const stats = []
    
    // Net growth stat
    if (metrics.netGrowth !== 0) {
      stats.push({
        value: `${metrics.netGrowth > 0 ? '+' : ''}${metrics.netGrowth}`,
        label: 'Net Growth',
        color: metrics.netGrowth > 0 ? 'text-green-600' : 'text-red-600'
      })
    }
    
    // Conversion rate stat
    if (metrics.conversionRate > 0) {
      stats.push({
        value: `${metrics.conversionRate}%`,
        label: 'Conversion Rate',
        color: metrics.conversionRate > 15 ? 'text-green-600' : metrics.conversionRate > 5 ? 'text-blue-600' : 'text-orange-600'
      })
    }
    
    // Churn rate stat
    if (metrics.churnRate > 0) {
      stats.push({
        value: `${metrics.churnRate}%`,
        label: 'Churn Rate',
        color: metrics.churnRate < 10 ? 'text-green-600' : metrics.churnRate < 20 ? 'text-orange-600' : 'text-red-600'
      })
    }
    
    // If we don't have enough stats, add some basic ones
    if (stats.length < 3) {
      if (metrics.followers > 0) {
        stats.push({
          value: metrics.followers.toString(),
          label: 'New Followers',
          color: 'text-blue-600'
        })
      }
      if (metrics.unfollowers > 0) {
        stats.push({
          value: metrics.unfollowers.toString(),
          label: 'Unfollowers',
          color: 'text-red-600'
        })
      }
      if (metrics.uniqueProfiles > 0) {
        stats.push({
          value: metrics.uniqueProfiles.toString(),
          label: 'Unique Profiles',
          color: 'text-purple-600'
        })
      }
    }
    
    return stats.slice(0, 3)
  }

  // Generate AI summary blurb
  const generateAISummary = () => {
    if (!metrics || !campaign) return "No data available for this campaign yet."
    
    const campaignType = campaign.campaign_type.toLowerCase()
    const netGrowth = metrics.netGrowth
    const conversionRate = metrics.conversionRate
    const churnRate = metrics.churnRate
    const totalAttributions = metrics.totalAttributions
    
    if (totalAttributions === 0) {
      return `This ${campaignType} campaign "${campaignName}" has no attributed events yet. To see detailed analytics, manually attribute recent follower/unfollower events to this campaign using the Attribution Tracking tab.`
    }
    
    let summary = `Your ${campaignType} campaign "${campaignName}" `
    
    if (netGrowth > 0) {
      summary += `achieved strong performance with a net growth of ${netGrowth} followers and a ${conversionRate}% conversion rate. `
      if (churnRate < 10) {
        summary += `The low ${churnRate}% churn rate indicates excellent audience retention. `
      } else if (churnRate > 20) {
        summary += `However, the high ${churnRate}% churn rate suggests room for improvement in content quality or audience targeting. `
      }
      summary += `This campaign demonstrates effective audience engagement and content resonance.`
    } else if (netGrowth < 0) {
      summary += `faced challenges with a net loss of ${Math.abs(netGrowth)} followers and a ${conversionRate}% conversion rate. `
      if (churnRate > 25) {
        summary += `The high ${churnRate}% churn rate indicates significant audience dissatisfaction. `
      }
      summary += `Consider analyzing content timing, quality, and audience targeting to improve future performance.`
    } else {
      summary += `maintained stable performance with ${metrics.followers} new followers and ${metrics.unfollowers} unfollowers. `
      summary += `While neutral, there's opportunity to optimize content strategy to drive positive growth.`
    }
    
    return summary
  }

  // AI-generated insights based on actual data
  const generateInsights = () => {
    if (!metrics) return []

    const insights = []
    const campaignType = campaign?.campaign_type || 'CONTENT'

    // Growth analysis with contextual messaging
    if (metrics.netGrowth > 0) {
      const growthStrength = metrics.netGrowth > 10 ? 'exceptional' : metrics.netGrowth > 5 ? 'strong' : 'moderate'
      insights.push({
        type: 'positive',
        icon: TrendingUp,
        title: `${growthStrength.charAt(0).toUpperCase() + growthStrength.slice(1)} Growth Performance`,
        message: `Your ${campaignType.toLowerCase()} campaign achieved a net growth of ${metrics.netGrowth} followers with a ${metrics.conversionRate}% conversion rate. This indicates effective audience engagement and content resonance. ${metrics.netGrowth > 10 ? 'Consider scaling this successful strategy.' : ''}`
      })
    } else if (metrics.netGrowth < 0) {
      const lossSeverity = Math.abs(metrics.netGrowth) > 10 ? 'significant' : 'moderate'
      insights.push({
        type: 'negative',
        icon: TrendingDown,
        title: `${lossSeverity.charAt(0).toUpperCase() + lossSeverity.slice(1)} Growth Decline`,
        message: `Your campaign resulted in a net loss of ${Math.abs(metrics.netGrowth)} followers. This ${lossSeverity} decline suggests potential issues with content timing, quality, or audience targeting. Consider A/B testing different content approaches.`
      })
    } else {
      insights.push({
        type: 'neutral',
        icon: BarChart3,
        title: 'Stable Performance',
        message: `Your campaign maintained neutral growth with ${metrics.followers} new followers and ${metrics.unfollowers} unfollowers. While stable, there's opportunity to optimize content strategy to drive positive growth.`
      })
    }

    // Conversion rate analysis with industry context
    if (metrics.conversionRate > 20) {
      insights.push({
        type: 'positive',
        icon: Target,
        title: 'Outstanding Conversion Rate',
        message: `Your ${metrics.conversionRate}% conversion rate is exceptional for ${campaignType.toLowerCase()} campaigns. This suggests your content strategy is highly effective and well-aligned with your target audience.`
      })
    } else if (metrics.conversionRate > 10) {
      insights.push({
        type: 'positive',
        icon: Target,
        title: 'Good Conversion Rate',
        message: `Your ${metrics.conversionRate}% conversion rate is solid for ${campaignType.toLowerCase()} campaigns. There's room for optimization, but you're on the right track.`
      })
    } else if (metrics.conversionRate > 0) {
      insights.push({
        type: 'warning',
        icon: Target,
        title: 'Low Conversion Rate',
        message: `Your ${metrics.conversionRate}% conversion rate indicates significant room for improvement. Consider refining your content strategy, posting times, and audience targeting to boost engagement.`
      })
    }

    // Churn rate analysis with actionable advice
    if (metrics.churnRate > 30) {
      insights.push({
        type: 'negative',
        icon: UserMinus,
        title: 'Critical Churn Rate',
        message: `Your ${metrics.churnRate}% churn rate is alarmingly high. This suggests content quality issues, over-posting, or audience mismatch. Immediate action needed: review content strategy and posting frequency.`
      })
    } else if (metrics.churnRate > 20) {
      insights.push({
        type: 'warning',
        icon: UserMinus,
        title: 'High Churn Rate',
        message: `Your ${metrics.churnRate}% churn rate is above average. Consider reducing posting frequency, improving content quality, and ensuring content aligns with audience expectations.`
      })
    } else if (metrics.churnRate < 5) {
      insights.push({
        type: 'positive',
        icon: Users,
        title: 'Excellent Retention',
        message: `Your ${metrics.churnRate}% churn rate shows exceptional audience retention. Your content strategy is highly effective at maintaining follower engagement.`
      })
    } else if (metrics.churnRate < 15) {
      insights.push({
        type: 'positive',
        icon: Users,
        title: 'Good Retention',
        message: `Your ${metrics.churnRate}% churn rate indicates strong audience retention. Your content is resonating well with your followers.`
      })
    }

    // Engagement patterns with detailed analysis
    if (metrics.uniqueProfiles > 0) {
      const avgEngagement = metrics.avgEventsPerProfile
      if (avgEngagement > 3) {
        insights.push({
          type: 'positive',
          icon: Users,
          title: 'Exceptional Engagement',
          message: `Users show exceptional engagement with an average of ${avgEngagement.toFixed(1)} interactions per profile. This indicates highly compelling content that drives multiple interactions.`
        })
      } else if (avgEngagement > 1.5) {
        insights.push({
          type: 'positive',
          icon: Users,
          title: 'High Engagement',
          message: `Users are highly engaged with an average of ${avgEngagement.toFixed(1)} interactions per profile. This suggests strong content quality and audience interest.`
        })
      } else if (avgEngagement < 0.5) {
        insights.push({
          type: 'warning',
          icon: Users,
          title: 'Low Engagement',
          message: `Users show low engagement with an average of ${avgEngagement.toFixed(1)} interactions per profile. Consider improving content quality and relevance to boost engagement.`
        })
      }
    }

    // Peak performance analysis with strategic recommendations
    if (metrics.peakEngagementDay) {
      const peakDay = new Date(metrics.peakEngagementDay.date)
      const dayName = peakDay.toLocaleDateString('en-US', { weekday: 'long' })
      insights.push({
        type: 'info',
        icon: Calendar,
        title: 'Peak Performance Day Identified',
        message: `Your best performing day was ${dayName} (${formatDate(metrics.peakEngagementDay.date, 'date')}) with ${metrics.peakEngagementDay.followers} new followers. Consider scheduling similar high-impact content on ${dayName}s for optimal reach.`
      })
    }

    // Data quality insights with actionable steps
    if (metrics.totalAttributions === 0) {
      insights.push({
        type: 'warning',
        icon: Eye,
        title: 'No Attribution Data Available',
        message: `This campaign has no attributed events yet. To unlock detailed analytics, manually attribute recent follower/unfollower events to this campaign using the Attribution Tracking tab.`
      })
    } else if (metrics.totalAttributions < 5) {
      insights.push({
        type: 'info',
        icon: Eye,
        title: 'Limited Attribution Data',
        message: `This campaign has only ${metrics.totalAttributions} attributed events. Consider attributing more events to get comprehensive insights and better performance analysis.`
      })
    }

    // Campaign-specific recommendations
    if (campaignType === 'OUTBOUND_FOLLOW' && metrics.followers > 0) {
      insights.push({
        type: 'info',
        icon: Target,
        title: 'Outbound Follow Strategy',
        message: `Your outbound follow campaign generated ${metrics.followers} new followers. Consider following up with engaging content to maintain these new connections and convert them into long-term followers.`
      })
    }

    // Performance comparison insights
    if (metrics.followers > 0 && metrics.unfollowers > 0) {
      const retentionRate = ((metrics.followers - metrics.unfollowers) / metrics.followers) * 100
      if (retentionRate > 80) {
        insights.push({
          type: 'positive',
          icon: TrendingUp,
          title: 'Excellent Follower Retention',
          message: `Your campaign shows ${retentionRate.toFixed(1)}% follower retention rate, indicating high-quality audience acquisition. This suggests your targeting and content strategy are well-aligned.`
        })
      } else if (retentionRate < 50) {
        insights.push({
          type: 'warning',
          icon: TrendingDown,
          title: 'Low Follower Retention',
          message: `Your campaign shows only ${retentionRate.toFixed(1)}% follower retention rate. Consider improving content quality and ensuring better audience targeting to reduce unfollows.`
        })
      }
    }

    return insights
  }

  const insights = generateInsights()
  const top3Stats = tagInsights?.topStats || generateTop3Stats()
  const aiSummary = tagInsights?.generalizations?.join(' ') || generateAISummary()
  const { followers, churns } = getFollowersAndChurns()

  return (
    <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between w-full hover:text-primary cursor-pointer py-2">
          <div className="flex items-center gap-2">
            {children}
          </div>
          <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`} />
        </div>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="space-y-4 mt-4">
        <Card className="overflow-hidden max-w-full">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-medium">{campaignName}</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              {campaign?.campaign_type} • {formatDate(campaign?.campaign_date || new Date(), 'date')}
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-hidden max-w-full">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                <span className="ml-3 text-muted-foreground">Loading insights...</span>
              </div>
            ) : campaign && metrics ? (
              <div className="space-y-6">
                  {/* Two Column Layout */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-full">
                  {/* Left Side - Follows/Churns */}
                  <div className="space-y-4">
                    <div className="flex border-b">
                      <button
                        onClick={() => setActiveTab('follows')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                          activeTab === 'follows'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Follows ({followers.length})
                      </button>
                      <button
                        onClick={() => setActiveTab('churns')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                          activeTab === 'churns'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Churns ({churns.length})
                      </button>
                    </div>

                    {/* User Lists */}
                    <div className="max-h-64 overflow-y-auto">
                      {activeTab === 'follows' ? (
                        followers.length > 0 ? (
                          <div className="space-y-2">
                            {followers.map((user: any, index: number) => (
                              <div key={index} className="flex items-center justify-between p-2 border rounded-lg">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                  <span className="font-medium">@{user.username}</span>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {formatDate(user.date, 'date')}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>No followers from this campaign</p>
                          </div>
                        )
                      ) : (
                        churns.length > 0 ? (
                          <div className="space-y-2">
                            {churns.map((user: any, index: number) => (
                              <div key={index} className="flex items-center justify-between p-2 border rounded-lg">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                  <span className="font-medium">@{user.username}</span>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {formatDate(user.date, 'date')}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            <UserMinus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>No unfollowers from this campaign</p>
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  {/* Right Side - Key Metrics & Summary */}
                  <div className="space-y-4 min-w-0">
                    {/* Top 3 Key Stats in Colored Boxes */}
                    <div className="space-y-3">
                      {top3Stats.map((stat: any, index: number) => (
                        <div key={index} className={`p-4 rounded-lg border-2 ${
                          stat.bgColor || 'bg-gray-50'
                        } ${
                          stat.borderColor || 'border-gray-200'
                        }`}>
                          <div className={`text-2xl font-bold ${stat.color || 'text-gray-600'}`}>
                            {stat.value}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {stat.label}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* AI Summary Blurb */}
                    <div className="p-4 bg-muted rounded-lg min-w-0 max-w-full">
                      <h4 className="font-semibold mb-2">Generalizations</h4>
                      <p className="text-sm leading-relaxed break-words overflow-wrap-anywhere hyphens-auto whitespace-normal word-break-break-word">{aiSummary}</p>
                    </div>
                  </div>
                </div>

                {/* Date Range Selector */}
                <div className="flex gap-2 pt-4 border-t">
                  <span className="text-sm font-medium mr-2">Analysis Period:</span>
                  {['7', '30', '90', '365'].map((days) => (
                    <Button
                      key={days}
                      variant={dateRange === days ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setDateRange(days)}
                    >
                      {days} days
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No campaign data available</p>
                <p className="text-sm">This campaign may not have any attributed events yet.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  )
}
