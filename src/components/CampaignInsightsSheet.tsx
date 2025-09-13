'use client'

import { useState } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useCampaignAnalytics } from '@/lib/hooks'
import { formatDate } from '@/lib/dates'
import { TrendingUp, TrendingDown, Users, UserMinus, BarChart3, Calendar, Target, Eye } from 'lucide-react'

interface CampaignInsightsSheetProps {
  campaignId: number | null
  open: boolean
  onClose: () => void
}

export function CampaignInsightsSheet({ campaignId, open, onClose }: CampaignInsightsSheetProps) {
  const [dateRange, setDateRange] = useState('30')
  
  const { data: analytics, isLoading } = useCampaignAnalytics({
    campaignId: campaignId || undefined,
    dateRange: parseInt(dateRange)
  })

  if (!campaignId) return null

  const campaign = analytics?.campaign
  const metrics = analytics?.metrics

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-4xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Campaign Insights
          </SheetTitle>
          <SheetDescription>
            Detailed analytics and performance metrics for your campaign
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-3 text-muted-foreground">Loading insights...</span>
          </div>
        ) : campaign && metrics ? (
          <div className="space-y-6 py-6">
            {/* Campaign Header */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl">{campaign.campaign_name}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-2">
                      <Calendar className="h-4 w-4" />
                      {formatDate(campaign.campaign_date, 'date')}
                      <Badge variant={campaign.campaign_type === 'CONTENT' ? 'default' : 'secondary'}>
                        {campaign.campaign_type}
                      </Badge>
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary">
                      {metrics.netGrowth > 0 ? '+' : ''}{metrics.netGrowth}
                    </div>
                    <div className="text-sm text-muted-foreground">Net Growth</div>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-green-600" />
                    <div>
                      <div className="text-2xl font-bold text-green-600">{metrics.followers}</div>
                      <div className="text-xs text-muted-foreground">New Followers</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <UserMinus className="h-4 w-4 text-red-600" />
                    <div>
                      <div className="text-2xl font-bold text-red-600">{metrics.unfollowers}</div>
                      <div className="text-xs text-muted-foreground">Unfollowers</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-blue-600" />
                    <div>
                      <div className="text-2xl font-bold text-blue-600">{metrics.conversionRate}%</div>
                      <div className="text-xs text-muted-foreground">Conversion Rate</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-orange-600" />
                    <div>
                      <div className="text-2xl font-bold text-orange-600">{metrics.churnRate}%</div>
                      <div className="text-xs text-muted-foreground">Churn Rate</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Engagement Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Engagement Analysis
                </CardTitle>
                <CardDescription>
                  Detailed breakdown of campaign performance over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Total Interactions</div>
                      <div className="text-2xl font-bold">{metrics.totalAttributions}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Unique Profiles</div>
                      <div className="text-2xl font-bold">{metrics.uniqueProfiles}</div>
                    </div>
                  </div>
                  
                  {metrics.peakEngagementDay && (
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-sm font-medium">Peak Engagement Day</div>
                      <div className="text-lg">
                        {formatDate(metrics.peakEngagementDay.date, 'date')} 
                        <span className="text-muted-foreground ml-2">
                          ({metrics.peakEngagementDay.followers} followers, {metrics.peakEngagementDay.unfollowers} unfollowers)
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Daily Breakdown */}
            {metrics.dailyBreakdown && metrics.dailyBreakdown.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Daily Performance
                  </CardTitle>
                  <CardDescription>
                    Day-by-day breakdown of campaign engagement
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {metrics.dailyBreakdown.map((day: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="text-sm font-medium">
                            {formatDate(day.date, 'date')}
                          </div>
                          <div className="flex gap-2">
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              +{day.followers}
                            </Badge>
                            <Badge variant="outline" className="text-red-600 border-red-600">
                              -{day.unfollowers}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {day.total} total
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Insights & Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Insights & Recommendations
                </CardTitle>
                <CardDescription>
                  AI-generated insights based on campaign performance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics.netGrowth > 0 ? (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />
                        <div>
                          <div className="font-medium text-green-800">Positive Growth</div>
                          <div className="text-sm text-green-700">
                            Your campaign gained {metrics.followers} new followers with a {metrics.conversionRate}% conversion rate. 
                            This suggests strong engagement with your content.
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <TrendingDown className="h-5 w-5 text-red-600 mt-0.5" />
                        <div>
                          <div className="font-medium text-red-800">Negative Growth</div>
                          <div className="text-sm text-red-700">
                            Your campaign resulted in a net loss of {Math.abs(metrics.netGrowth)} followers. 
                            Consider analyzing the content strategy and timing.
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {metrics.churnRate > 20 && (
                    <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <UserMinus className="h-5 w-5 text-orange-600 mt-0.5" />
                        <div>
                          <div className="font-medium text-orange-800">High Churn Rate</div>
                          <div className="text-sm text-orange-700">
                            Your churn rate of {metrics.churnRate}% is above average. Consider reviewing your content 
                            quality and audience targeting strategy.
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {metrics.peakEngagementDay && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <Calendar className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div>
                          <div className="font-medium text-blue-800">Peak Performance Day</div>
                          <div className="text-sm text-blue-700">
                            Your best performing day was {formatDate(metrics.peakEngagementDay.date, 'date')}. 
                            Consider posting similar content on this day of the week in future campaigns.
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Date Range Selector */}
            <Card>
              <CardHeader>
                <CardTitle>Analysis Period</CardTitle>
                <CardDescription>
                  Adjust the time range for your analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
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
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No campaign data available</p>
            <p className="text-sm">This campaign may not have any attributed events yet.</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
