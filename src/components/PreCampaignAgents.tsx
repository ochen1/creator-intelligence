'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Lightbulb, TrendingUp, Hash, Target, Loader2 } from 'lucide-react'

interface ContentOptimizationResult {
  originalText: string
  suggestions: {
    type: 'clarity' | 'engagement' | 'brand_voice' | 'cta'
    suggestion: string
    reason: string
  }[]
  optimizedText: string
  score: number
}

interface TrendResearchResult {
  hashtags: {
    tag: string
    popularity: number
    relevance: number
    description: string
  }[]
  accounts: {
    username: string
    followers: number
    engagement_rate: number
    relevance: string
  }[]
  topics: {
    topic: string
    trend_score: number
    description: string
  }[]
}

export function PreCampaignAgents() {
  const [activeAgent, setActiveAgent] = useState<'content' | 'trends' | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Content Optimization Agent
  const [draftText, setDraftText] = useState('')
  const [contentResult, setContentResult] = useState<ContentOptimizationResult | null>(null)

  // Trend Research Agent
  const [campaignTopic, setCampaignTopic] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [trendResult, setTrendResult] = useState<TrendResearchResult | null>(null)

  const handleContentOptimization = async () => {
    if (!draftText.trim()) return

    setIsLoading(true)
    try {
      // This would typically call the swarm API with content optimization instructions
      const response = await fetch('/api/swarm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `Analyze and optimize this content for Instagram: "${draftText}". Provide specific suggestions for improving clarity, engagement, brand voice, and call-to-action. Then provide an optimized version.`
        }),
      })

      const { executionId } = await response.json()

      // For demo purposes, simulate a result
      setTimeout(() => {
        setContentResult({
          originalText: draftText,
          suggestions: [
            {
              type: 'engagement',
              suggestion: 'Add a question to encourage comments',
              reason: 'Questions increase engagement by 23% on average'
            },
            {
              type: 'clarity',
              suggestion: 'Break up long sentences for better readability',
              reason: 'Shorter sentences are easier to scan on mobile'
            },
            {
              type: 'cta',
              suggestion: 'Include a clear call-to-action',
              reason: 'CTAs improve conversion rates by 15-20%'
            }
          ],
          optimizedText: draftText + '\n\nWhat do you think? Share your thoughts below! 👇',
          score: 8.5
        })
        setIsLoading(false)
      }, 2000)

    } catch (error) {
      console.error('Content optimization failed:', error)
      setIsLoading(false)
    }
  }

  const handleTrendResearch = async () => {
    if (!campaignTopic.trim()) return

    setIsLoading(true)
    try {
      // This would typically call the swarm API with trend research instructions
      const response = await fetch('/api/swarm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `Research current trends for "${campaignTopic}" campaign targeting "${targetAudience}". Find relevant hashtags, accounts to mention, and trending topics.`
        }),
      })

      const { executionId } = await response.json()

      // For demo purposes, simulate a result
      setTimeout(() => {
        setTrendResult({
          hashtags: [
            { tag: '#contentcreator', popularity: 95, relevance: 88, description: 'Highly popular among creators' },
            { tag: '#instagramtips', popularity: 78, relevance: 92, description: 'Perfect for educational content' },
            { tag: '#socialmedia', popularity: 89, relevance: 75, description: 'Broad appeal, good reach' }
          ],
          accounts: [
            { username: '@socialmediaexpert', followers: 150000, engagement_rate: 5.2, relevance: 'Industry thought leader' },
            { username: '@contentstrategy', followers: 89000, engagement_rate: 4.8, relevance: 'Strategy focused' }
          ],
          topics: [
            { topic: 'AI in Content Creation', trend_score: 92, description: 'Rapidly growing interest' },
            { topic: 'Micro-Influencer Marketing', trend_score: 85, description: 'Steady upward trend' }
          ]
        })
        setIsLoading(false)
      }, 2000)

    } catch (error) {
      console.error('Trend research failed:', error)
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Pre-Campaign AI Agents</h2>
        <p className="text-muted-foreground">
          Optimize your content and research trends before launching campaigns
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Content Optimization Agent */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-500" />
              Content Optimization Agent
            </CardTitle>
            <CardDescription>
              Get AI-powered suggestions to improve your content's clarity, engagement, and effectiveness
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Draft Content</label>
              <Textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                placeholder="Paste your draft Instagram caption or content here..."
                rows={4}
              />
            </div>

            <Button 
              onClick={handleContentOptimization}
              disabled={!draftText.trim() || isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing Content...
                </>
              ) : (
                <>
                  <Lightbulb className="w-4 h-4 mr-2" />
                  Optimize Content
                </>
              )}
            </Button>

            {contentResult && (
              <div className="space-y-4 mt-4">
                <Separator />
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Optimization Score</h4>
                    <Badge variant="secondary">{contentResult.score}/10</Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Suggestions</h4>
                  <div className="space-y-2">
                    {contentResult.suggestions.map((suggestion, index) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {suggestion.type.replace('_', ' ')}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium">{suggestion.suggestion}</p>
                        <p className="text-xs text-muted-foreground">{suggestion.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Optimized Version</h4>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm whitespace-pre-wrap">{contentResult.optimizedText}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Trend Research Agent */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              Trend Research Agent
            </CardTitle>
            <CardDescription>
              Discover trending hashtags, relevant accounts, and topics for your campaign
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Campaign Topic</label>
              <Input
                value={campaignTopic}
                onChange={(e) => setCampaignTopic(e.target.value)}
                placeholder="e.g., Social Media Tips, Fitness Journey, Recipe Ideas"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Target Audience</label>
              <Input
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="e.g., Content Creators, Fitness Enthusiasts, Food Lovers"
              />
            </div>

            <Button 
              onClick={handleTrendResearch}
              disabled={!campaignTopic.trim() || isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Researching Trends...
                </>
              ) : (
                <>
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Research Trends
                </>
              )}
            </Button>

            {trendResult && (
              <div className="space-y-4 mt-4">
                <Separator />
                
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Hash className="w-4 h-4" />
                    <h4 className="font-medium">Trending Hashtags</h4>
                  </div>
                  <div className="space-y-2">
                    {trendResult.hashtags.map((hashtag, index) => (
                      <div key={index} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <p className="font-medium text-sm">{hashtag.tag}</p>
                          <p className="text-xs text-muted-foreground">{hashtag.description}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary" className="text-xs">
                            {hashtag.relevance}% match
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    <h4 className="font-medium">Trending Topics</h4>
                  </div>
                  <div className="space-y-2">
                    {trendResult.topics.map((topic, index) => (
                      <div key={index} className="p-2 border rounded">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm">{topic.topic}</p>
                          <Badge variant="outline" className="text-xs">
                            {topic.trend_score}% trending
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{topic.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}