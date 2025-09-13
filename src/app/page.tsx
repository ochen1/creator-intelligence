'use client'

import { useState } from 'react'
import { CampaignManager } from '@/components/CampaignManager'
import { ProfileList } from '@/components/ProfileList'
import { ProfileSheet } from '@/components/ProfileSheet'
import { BulkProfilesAttributionSheet } from '@/components/BulkProfilesAttributionSheet'
import { DataIngestion } from '@/components/DataIngestion'
import { ProfileIdentification } from '@/components/ProfileIdentification'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function HomePage() {
  const [selectedUsername, setSelectedUsername] = useState<string | null>(null)
  const [selectedProfilePks, setSelectedProfilePks] = useState<number[]>([])
  const [bulkAttributionOpen, setBulkAttributionOpen] = useState(false)

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

      {/* Campaign Management */}
      <CampaignManager />

      <Separator />

      {/* Profile Management */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Audience Management</h2>
        </div>

        <ProfileList
          onSelectProfile={(username) => setSelectedUsername(username)}
          selectedProfilePks={selectedProfilePks}
          onSelectionChange={setSelectedProfilePks}
          onBulkAttribution={() => setBulkAttributionOpen(true)}
        />
      </div>

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
