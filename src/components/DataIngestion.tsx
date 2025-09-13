'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Upload, FileArchive, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

type IngestionStatus = 'idle' | 'processing' | 'success' | 'error'

interface IngestionResult {
  snapshot_date: string
  new_profiles: number
  total_events_created: number
  event_breakdown: Record<string, number>
  profile_updates: number
}

export function DataIngestion() {
  const [status, setStatus] = useState<IngestionStatus>('idle')
  const [result, setResult] = useState<IngestionResult | null>(null)
  const [error, setError] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.zip')) {
      toast.error('Please select a ZIP file')
      return
    }

    setStatus('processing')
    setError('')
    setResult(null)

    try {
      // Read the ZIP file
      const arrayBuffer = await file.arrayBuffer()
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      const zipContents = await zip.loadAsync(arrayBuffer)

      // Extract required files
      const extractFile = async (path: string): Promise<string> => {
        // Try exact path first
        let zipFile = zipContents.file(path)
        
        // If not found, try with any root directory prefix
        if (!zipFile) {
          const allFiles = Object.keys(zipContents.files)
          const matchingFile = allFiles.find(fileName => 
            fileName.endsWith(path) || fileName.includes(path.replace('connections/', ''))
          )
          
          if (matchingFile) {
            zipFile = zipContents.file(matchingFile)
          }
        }

        if (!zipFile) {
          throw new Error(`Required file not found: ${path}`)
        }

        return await zipFile.async('text')
      }

      const followers1Json = await extractFile('connections/followers_and_following/followers_1.json')
      const followingJson = await extractFile('connections/followers_and_following/following.json')
      const pendingFollowRequestsJson = await extractFile('connections/followers_and_following/pending_follow_requests.json')

      // Send to ingestion API
      const response = await fetch('/api/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          followers_1_json: followers1Json,
          following_json: followingJson,
          pending_follow_requests_json: pendingFollowRequestsJson,
          original_zip_filename: file.name,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Ingestion failed')
      }

      const responseData = await response.json()
      setResult(responseData.data || responseData)
      setStatus('success')
      toast.success('Data ingested successfully!')

    } catch (err: any) {
      setError(err.message || 'An error occurred during ingestion')
      setStatus('error')
      toast.error('Ingestion failed: ' + (err.message || 'Unknown error'))
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'processing':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />
      default:
        return <FileArchive className="h-5 w-5 text-muted-foreground" />
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'processing':
        return 'Processing Instagram data export...'
      case 'success':
        return 'Data ingested successfully'
      case 'error':
        return 'Ingestion failed'
      default:
        return 'Ready to process Instagram data export'
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Data Ingestion
        </CardTitle>
        <CardDescription>
          Upload your Instagram data export ZIP file to import follower and following data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Upload Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <span className="text-sm font-medium">{getStatusText()}</span>
          </div>

          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
            <div className="text-center space-y-4">
              <FileArchive className="h-12 w-12 text-muted-foreground mx-auto" />
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Upload Instagram Data Export</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Select the ZIP file you downloaded from Instagram's data export feature.
                  The file should contain follower and following data.
                </p>
              </div>
              <Button
                onClick={handleFileSelect}
                disabled={status === 'processing'}
                size="lg"
              >
                <Upload className="h-4 w-4 mr-2" />
                {status === 'processing' ? 'Processing...' : 'Select ZIP File'}
              </Button>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Error Display */}
        {status === 'error' && error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="font-medium text-red-800">Ingestion Error</span>
            </div>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Success Results */}
        {status === 'success' && result && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-3">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="font-medium text-green-800">Ingestion Complete</span>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-700">{result.new_profiles}</div>
                <div className="text-xs text-green-600">New Profiles</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-700">{result.total_events_created}</div>
                <div className="text-xs text-green-600">Events Created</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-700">{result.profile_updates}</div>
                <div className="text-xs text-green-600">Profiles Updated</div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-green-800">Event Breakdown:</h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(result.event_breakdown).map(([eventType, count]) => (
                  <Badge key={eventType} variant="outline" className="border-green-300 text-green-700">
                    {eventType}: {count}
                  </Badge>
                ))}
              </div>
            </div>

            <p className="text-sm text-green-700">
              Snapshot date: <strong>{result.snapshot_date}</strong>
            </p>
          </div>
        )}

        {/* Instructions */}
        <div className="rounded-lg bg-muted/50 p-4 space-y-2">
          <h4 className="font-medium">How to get your Instagram data:</h4>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Go to Instagram Settings & Privacy → Account Center → Your information and permissions → Download your information</li>
            <li>Request a download of your data in JSON format</li>
            <li>Instagram will email you a download link (this can take a few days)</li>
            <li>Download and extract the ZIP file, then upload it here</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  )
}