'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useCampaigns, useCampaignMutations } from '@/lib/hooks'
import { formatDate } from '@/lib/dates'
import { PlusCircle, Trash2, ChevronRight } from 'lucide-react'
import { CampaignInsightsDropdown } from './CampaignInsightsDropdown'

const CAMPAIGN_TYPES = ['CONTENT', 'OUTBOUND_FOLLOW'] as const

export function CampaignManager() {
  const [newCampaignName, setNewCampaignName] = useState('')
  const [newCampaignDate, setNewCampaignDate] = useState('')
  const [newCampaignType, setNewCampaignType] = useState<'CONTENT' | 'OUTBOUND_FOLLOW'>('CONTENT')
  const [expandedCampaignId, setExpandedCampaignId] = useState<number | null>(null)

  const { data: campaigns, isLoading } = useCampaigns()
  const { create, remove } = useCampaignMutations()

  const handleCreateCampaign = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCampaignName.trim() || !newCampaignDate) {
      return
    }

    create.mutate({
      campaign_name: newCampaignName.trim(),
      campaign_date: newCampaignDate,
      campaign_type: newCampaignType
    }, {
      onSuccess: () => {
        setNewCampaignName('')
        setNewCampaignDate('')
        setNewCampaignType('CONTENT')
      }
    })
  }

  const handleDeleteCampaign = (campaign: any) => {
    if (window.confirm(`Delete campaign "${campaign.campaign_name}"? This cannot be undone.`)) {
      remove.mutate(campaign.campaign_id)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign Management</CardTitle>
        <CardDescription>
          Create and manage your campaigns for tracking attribution and engagement.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Create Campaign Form */}
        <form onSubmit={handleCreateCampaign} className="grid gap-4 md:grid-cols-4 md:items-end">
          <div className="space-y-2">
            <label htmlFor="campaign-name" className="text-sm font-medium">Campaign Name</label>
            <Input
              id="campaign-name"
              value={newCampaignName}
              onChange={(e) => setNewCampaignName(e.target.value)}
              placeholder="e.g., Summer Product Launch"
              required
            />
          </div>
          
          <div className="space-y-2">
            <label htmlFor="campaign-date" className="text-sm font-medium">Campaign Date</label>
            <Input
              id="campaign-date"
              type="date"
              value={newCampaignDate}
              onChange={(e) => setNewCampaignDate(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <label htmlFor="campaign-type" className="text-sm font-medium">Type</label>
            <Select
              value={newCampaignType}
              onValueChange={(value) => setNewCampaignType(value as 'CONTENT' | 'OUTBOUND_FOLLOW')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CAMPAIGN_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Button type="submit" disabled={create.isPending} className="w-full md:w-auto">
            <PlusCircle className="mr-2 h-4 w-4" />
            {create.isPending ? 'Creating...' : 'Create Campaign'}
          </Button>
        </form>

        {/* Campaigns List */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Existing Campaigns</h3>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              <span className="ml-2 text-sm text-muted-foreground">Loading campaigns...</span>
            </div>
          ) : campaigns && campaigns.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign Name</TableHead>
                    {expandedCampaignId === null && (
                      <TableHead className="w-[100px]">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((campaign) => (
                    <TableRow key={campaign.campaign_id}>
                      <TableCell className="font-medium">
                        <CampaignInsightsDropdown
                          campaignId={campaign.campaign_id}
                          campaignName={campaign.campaign_name}
                          onExpandedChange={(isExpanded) => {
                            setExpandedCampaignId(isExpanded ? campaign.campaign_id : null)
                          }}
                        >
                          <div className="flex items-center gap-2 hover:text-primary cursor-pointer">
                            {campaign.campaign_name}
                          </div>
                        </CampaignInsightsDropdown>
                      </TableCell>
                      {expandedCampaignId === null && (
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteCampaign(campaign)}
                            disabled={remove.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No campaigns created yet.</p>
              <p className="text-sm">Create your first campaign above to get started.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}