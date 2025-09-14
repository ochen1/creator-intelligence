'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { BarChart, Users, TrendingDown, AlertTriangle, FileText, Loader2 } from 'lucide-react'

interface Campaign {
  campaign_id: number
  campaign_name: string
  campaign_date: string
  campaign_type: string
}

interface PerformanceReport {
  campaign_name: string
  campaign_date: string
  followers_gained: number
  churned_followers: number
  churn_rate: number
  net_growth: number
  engagement_rate: number
  key_insights: string[]
  recommendations: string[]
}

interface ChurnAnalysis {
  total_churned: number
  churn_rate: number
  common_patterns: {
    pattern: string
    percentage: number
    count: number
    description: string
  }[]
  risk_factors: string[]
  retention_strategies: string[]
}

export function PostCampaignAgents() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [activeAgent, setActiveAgent] = useState<'performance' | 'churn' | null>(null)

  // Performance Report
  const [performanceReport, setPerformanceReport] = useState<PerformanceReport | null>(null)

  // Churn Analysis
  const [churnAnalysis, setChurnAnalysis] = useState<ChurnAnalysis | null>(null)

  // Load campaigns on component mount
  useEffect(() => {
    loadCampaigns()
  }, [])

  const loadCampaigns = async () => {
    try {
      const response = await fetch('/api/campaigns')
      const data = await response.json()
      setCampaigns(data.campaigns || [])
    } catch (error) {
      console.error('Failed to load campaigns:', error)
    }
  }

  const generatePerformanceReport = async () => {
    if (!selectedCampaign) return

    setIsLoading(true)
    setActiveAgent('performance')
    
    try {
      // This would call the swarm API with performance analysis instructions
      const response = await fetch('/api/swarm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `Generate a comprehensive performance report for campaign ID ${selectedCampaign}. Include metrics like followers gained, churn rate, engagement analysis, and strategic recommendations.`
        }),
      })

      const { executionId } = await response.json()

      // For demo purposes, simulate a result
      setTimeout(() => {
        setPerformanceReport({
          campaign_name: 'Content Creator Tips #3',
          campaign_date: '2024-01-15',
          followers_gained: 247,
          churned_followers: 23,
          churn_rate: 9.3,
          net_growth: 224,
          engagement_rate: 4.2,
          key_insights: [
            'Campaign attracted high-quality followers with 90.7% retention rate',
            'Peak engagement occurred within first 24 hours of posting',
            'Educational content performed 35% better than promotional posts',
            'Followers gained were primarily in the 25-34 age demographic'
          ],
          recommendations: [
            'Continue focusing on educational content to maintain engagement',
            'Post similar content during peak hours (7-9 PM) for maximum reach',
            'Consider creating a series around the most engaging topics',
            'Engage with new followers within 48 hours to improve retention'
          ]
        })
        setIsLoading(false)
      }, 3000)

    } catch (error) {
      console.error('Performance report generation failed:', error)
      setIsLoading(false)
    }
  }

  const analyzeChurnPatterns = async () => {
    if (!selectedCampaign) return

    setIsLoading(true)
    setActiveAgent('churn')
    
    try {
      // This would call the swarm API with churn analysis instructions
      const response = await fetch('/api/swarm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `Analyze churn patterns for campaign ID ${selectedCampaign}. Identify common characteristics of users who unfollowed, classify them by tags, and provide retention strategies.`
        }),
      })

      const { executionId } = await response.json()

      // For demo purposes, simulate a result
      setTimeout(() => {
        setChurnAnalysis({
          total_churned: 23,
          churn_rate: 9.3,
          common_patterns: [
            {
              pattern: 'Giveaway Hunters',
              percentage: 43.5,
              count: 10,
              description: 'Followers tagged with giveaway-related interests who likely followed for promotional content'
            },
            {
              pattern: 'Low Engagement Users',
              percentage: 26.1,
              count: 6,
              description: 'Users with historically low engagement rates across all content types'
            },
            {
              pattern: 'Mismatched Interest',
              percentage: 21.7,
              count: 5,
              description: 'Followers whose interests don\'t align with your primary content categories'
            },
            {
              pattern: 'Inactive Accounts',
              percentage: 8.7,
              count: 2,
              description: 'Accounts that show minimal activity and may be dormant or automated'
            }
          ],
          risk_factors: [
            'High proportion of followers from promotional campaigns',
            'Content shift away from original value proposition',
            'Decreased posting frequency in recent weeks',
            'Reduced interaction with follower comments'
          ],
          retention_strategies: [
            'Create welcome series for new followers explaining your content value',
            'Implement follower segmentation to deliver more targeted content',
            'Increase community engagement through polls and Q&A sessions',
            'Develop exclusive content for loyal followers to increase retention'
          ]
        })
        setIsLoading(false)
      }, 3000)

    } catch (error) {
      console.error('Churn analysis failed:', error)
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Post-Campaign AI Agents</h2>
        <p className="text-muted-foreground">
          Analyze campaign performance and understand audience behavior patterns
        </p>
      </div>

      {/* Campaign Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select Campaign to Analyze</CardTitle>
          <CardDescription>
            Choose a campaign to generate performance reports and churn analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium">Campaign</label>
              <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a campaign to analyze" />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.map((campaign) => (
                    <SelectItem key={campaign.campaign_id} value={campaign.campaign_id.toString()}>
                      {campaign.campaign_name} ({new Date(campaign.campaign_date).toLocaleDateString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={generatePerformanceReport}
                disabled={!selectedCampaign || (isLoading && activeAgent === 'performance')}
                variant="default"
              >
                {isLoading && activeAgent === 'performance' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <BarChart className="w-4 h-4 mr-2" />
                    Performance Report
                  </>
                )}
              </Button>
              <Button 
                onClick={analyzeChurnPatterns}
                disabled={!selectedCampaign || (isLoading && activeAgent === 'churn')}
                variant="outline"
              >
                {isLoading && activeAgent === 'churn' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <TrendingDown className="w-4 h-4 mr-2" />
                    Churn Analysis
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Report Results */}
        {performanceReport && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-green-500" />
                Performance Report
              </CardTitle>
              <CardDescription>
                Campaign: {performanceReport.campaign_name}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-green-600">+{performanceReport.followers_gained}</div>
                  <div className="text-sm text-muted-foreground">Followers Gained</div>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{performanceReport.churn_rate}%</div>
                  <div className="text-sm text-muted-foreground">Churn Rate</div>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">+{performanceReport.net_growth}</div>
                  <div className="text-sm text-muted-foreground">Net Growth</div>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">{performanceReport.engagement_rate}%</div>
                  <div className="text-sm text-muted-foreground">Engagement Rate</div>
                </div>
              </div>

              <Separator />

              {/* Key Insights */}
              <div className="space-y-2">
                <h4 className="font-medium">Key Insights</h4>
                <div className="space-y-2">
                  {performanceReport.key_insights.map((insight, index) => (
                    <div key={index} className="flex items-start gap-2 p-2 border rounded">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                      <p className="text-sm">{insight}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommendations */}
              <div className="space-y-2">
                <h4 className="font-medium">Recommendations</h4>
                <div className="space-y-2">
                  {performanceReport.recommendations.map((rec, index) => (
                    <div key={index} className="flex items-start gap-2 p-2 border rounded">
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                      <p className="text-sm">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Churn Analysis Results */}
        {churnAnalysis && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Churn Analysis
              </CardTitle>
              <CardDescription>
                Understanding why followers unfollow
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Churn Overview */}
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{churnAnalysis.total_churned}</div>
                  <div className="text-sm text-muted-foreground">Total Churned</div>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">{churnAnalysis.churn_rate}%</div>
                  <div className="text-sm text-muted-foreground">Churn Rate</div>
                </div>
              </div>

              <Separator />

              {/* Common Patterns */}
              <div className="space-y-2">
                <h4 className="font-medium">Churn Patterns</h4>
                <div className="space-y-2">
                  {churnAnalysis.common_patterns.map((pattern, index) => (
                    <div key={index} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{pattern.pattern}</span>
                        <Badge variant="destructive" className="text-xs">
                          {pattern.percentage}%
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{pattern.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {pattern.count} followers
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Retention Strategies */}
              <div className="space-y-2">
                <h4 className="font-medium">Retention Strategies</h4>
                <div className="space-y-2">
                  {churnAnalysis.retention_strategies.map((strategy, index) => (
                    <div key={index} className="flex items-start gap-2 p-2 border rounded">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                      <p className="text-sm">{strategy}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}