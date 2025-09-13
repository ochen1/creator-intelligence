'use client'

import { useState } from 'react'
import { CampaignManager } from '@/components/CampaignManager'
import { CampaignAnalyticsDashboard } from '@/components/CampaignAnalyticsDashboard'
import { ProfileList } from '@/components/ProfileList'
import { ProfileSheet } from '@/components/ProfileSheet'
import { BulkProfilesAttributionSheet } from '@/components/BulkProfilesAttributionSheet'
import { DataIngestion } from '@/components/DataIngestion'
import { ProfileIdentification } from '@/components/ProfileIdentification'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function HomePage() {
  const [selectedUsername, setSelectedUsername] = useState<string | null>(null)
  const [selectedProfilePks, setSelectedProfilePks] = useState<number[]>([])
  const [bulkAttributionOpen, setBulkAttributionOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  const clearSelection = () => {
    setSelectedProfilePks([])
  }

  return (
    <main className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold">Creator Intelligence Platform</h1>
        <p className="text-lg text-muted-foreground">
          Local-first audience intelligence platform for Instagram creators
        </p>
      </div>

      {/* Data Ingestion */}
      <DataIngestion />

      {/* Profile Identification */}
      <ProfileIdentification />
      
      <Separator />

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Analytics Dashboard</TabsTrigger>
          <TabsTrigger value="campaigns">Campaign Management</TabsTrigger>
          <TabsTrigger value="audience">Audience Management</TabsTrigger>
          <TabsTrigger value="attribution">Attribution Tracking</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">Campaign Analytics Dashboard</h2>
            <p className="text-muted-foreground">
              Comprehensive insights into your campaign performance, engagement metrics, and audience growth.
            </p>
          </div>
          <CampaignAnalyticsDashboard />
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">Campaign Management</h2>
            <p className="text-muted-foreground">
              Create and manage your content and outbound follow campaigns for tracking attribution.
            </p>
          </div>
          <CampaignManager />
        </TabsContent>

        <TabsContent value="audience" className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">Audience Management</h2>
            <p className="text-muted-foreground">
              Manage your audience profiles, tags, and track engagement patterns.
            </p>
          </div>
          <ProfileList
            onSelectProfile={(username) => setSelectedUsername(username)}
            selectedProfilePks={selectedProfilePks}
            onSelectionChange={setSelectedProfilePks}
            onBulkAttribution={() => setBulkAttributionOpen(true)}
          />
        </TabsContent>

        <TabsContent value="attribution" className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">Attribution Tracking</h2>
            <p className="text-muted-foreground">
              Review and manage attribution assignments for recent profile interactions.
            </p>
          </div>
          <div className="grid gap-6">
            <ProfileIdentification />
          </div>
        </TabsContent>
      </Tabs>

      {/* Profile Detail Sheet */}
      <ProfileSheet
        username={selectedUsername}
        open={!!selectedUsername}
        onClose={() => setSelectedUsername(null)}
      />

      {/* Bulk Attribution Sheet */}
      <BulkProfilesAttributionSheet
        profilePks={selectedProfilePks}
        open={bulkAttributionOpen}
        onOpenChange={setBulkAttributionOpen}
        onCompleted={() => {
          clearSelection()
          // You might want to refresh the profile list here
        }}
      />

      {/* Footer */}
      <div className="text-center pt-8 border-t">
        <p className="text-sm text-muted-foreground">
          Creator Intelligence Platform - Local-first audience management and attribution tracking
        </p>
      </div>
    </main>
  )
}
