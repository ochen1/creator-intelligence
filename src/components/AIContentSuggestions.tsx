'use client'

import { useState, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Upload, FileImage, FileText, Sparkles, Hash, AtSign, Palette, Download, RefreshCw, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface ColorPalette {
  hex: string
  name: string
}

interface ContentSuggestion {
  id: string
  type: 'hashtag' | 'mention' | 'caption' | 'color' | 'timing'
  content: string
  confidence: number
  reasoning: string
}

interface AIContentSuggestionsProps {
  className?: string
}

export function AIContentSuggestions({ className }: AIContentSuggestionsProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [suggestions, setSuggestions] = useState<ContentSuggestion[]>([])
  const [colorPalette, setColorPalette] = useState<ColorPalette[]>([])
  const [brandAnalysis, setBrandAnalysis] = useState<string[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    const file = files[0]
    
    if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
      setUploadedFile(file)
      createImagePreview(file)
      analyzeContent(file)
    } else {
      toast.error('Please upload a PDF or image file')
    }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
      setUploadedFile(file)
      createImagePreview(file)
      analyzeContent(file)
    } else {
      toast.error('Please upload a PDF or image file')
    }
  }, [])

  const createImagePreview = useCallback((file: File) => {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    } else {
      setImagePreview(null)
    }
  }, [])

  const analyzeContent = async (file: File) => {
    setIsAnalyzing(true)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await fetch('/api/ai/content-analysis', {
        method: 'POST',
        body: formData,
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        console.error('API Error:', errorData)
        throw new Error(errorData.error?.message || 'Failed to analyze content')
      }
      
      const data = await response.json()
      console.log('API Response:', data)
      
      if (!data.success) {
        throw new Error(data.error?.message || 'Analysis failed')
      }
      
      // Handle both direct data and nested data structure
      const responseData = data.data || data
      setSuggestions(responseData.suggestions || [])
      setColorPalette(responseData.colorPalette || [])
      setBrandAnalysis(responseData.brandAnalysis || [])
      
      toast.success('Content analyzed successfully!')
    } catch (error) {
      console.error('Error analyzing content:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to analyze content'
      toast.error(errorMessage)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const generateNewPost = async () => {
    setIsGenerating(true)
    
    try {
      const response = await fetch('/api/ai/generate-post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          suggestions,
          colorPalette,
          brandAnalysis,
        }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to generate post')
      }
      
      const data = await response.json()
      
      // Handle the generated post (could be a download or display)
      toast.success('New post generated!')
    } catch (error) {
      console.error('Error generating post:', error)
      toast.error('Failed to generate post')
    } finally {
      setIsGenerating(false)
    }
  }

  const resetUpload = () => {
    setUploadedFile(null)
    setImagePreview(null)
    setSuggestions([])
    setColorPalette([])
    setBrandAnalysis([])
  }

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'hashtag':
        return <Hash className="h-4 w-4" />
      case 'mention':
        return <AtSign className="h-4 w-4" />
      case 'color':
        return <Palette className="h-4 w-4" />
      default:
        return <Sparkles className="h-4 w-4" />
    }
  }

  const getSuggestionColor = (type: string) => {
    switch (type) {
      case 'hashtag':
        return 'bg-blue-100 text-blue-800 hover:bg-blue-200'
      case 'mention':
        return 'bg-green-100 text-green-800 hover:bg-green-200'
      case 'color':
        return 'bg-purple-100 text-purple-800 hover:bg-purple-200'
      case 'caption':
        return 'bg-orange-100 text-orange-800 hover:bg-orange-200'
      case 'timing':
        return 'bg-pink-100 text-pink-800 hover:bg-pink-200'
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200'
    }
  }

  return (
    <Card className={cn('w-full bg-white shadow-sm border-0 rounded-xl', className)}>
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-bold text-blue-600 flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          AI Content Suggestions
        </CardTitle>
        <CardDescription className="text-gray-600 text-base">
          Upload your promotional content (PDF or image) to get AI-powered suggestions based on your audience data and campaigns.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* File Upload Section */}
        <div className="space-y-4">
          {uploadedFile ? (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                {uploadedFile.type.startsWith('image/') ? (
                  <FileImage className="h-6 w-6 text-blue-600" />
                ) : (
                  <FileText className="h-6 w-6 text-blue-600" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">1 File Uploaded:</p>
                  <p className="text-sm text-gray-600">{uploadedFile.name}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('content-upload')?.click()}
                  className="border-blue-300 text-blue-600 hover:bg-blue-50"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Select ZIP Files
                </Button>
              </div>
            </div>
          ) : (
            <div
              className={cn(
                'border-2 border-dashed rounded-xl p-8 transition-colors',
                isDragOver 
                  ? 'border-blue-400 bg-blue-50' 
                  : 'border-blue-200 bg-blue-50'
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="text-center space-y-6">
                <div className="flex justify-center">
                  <Upload className="h-12 w-12 text-blue-600" />
                </div>
                
                <div className="space-y-3">
                  <p className="text-lg font-medium text-gray-900">
                    Drag and drop your promotional content here, or click to select
                  </p>
                  <p className="text-sm text-gray-600">
                    Supports PDF and image files (PNG, JPG, GIF, etc.)
                  </p>
                </div>
                
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.gif,.webp"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="content-upload"
                />
                <Button
                  onClick={() => document.getElementById('content-upload')?.click()}
                  disabled={isAnalyzing}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-8 py-3 rounded-lg font-medium"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Select Files
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Brand Analysis */}
        {brandAnalysis.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Brand Analysis</h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800 mb-2">
                Based off your profile, AI recognized that you:
              </p>
              <ul className="space-y-1">
                {brandAnalysis.map((item, index) => (
                  <li key={index} className="text-sm text-blue-700 flex items-start gap-2">
                    <span className="text-blue-500 mt-1">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Color Palette and Image Preview */}
        {colorPalette.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Recommended Color Palette</h3>
            <div className="flex gap-4 items-start">
              {/* Image Preview */}
              <div className="flex-shrink-0">
                <div className="w-48 h-32 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center overflow-hidden">
                  {imagePreview ? (
                    <img 
                      src={imagePreview} 
                      alt="Uploaded content preview" 
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : uploadedFile ? (
                    <div className="text-center text-sm text-gray-600">
                      <FileImage className="h-8 w-8 mx-auto mb-2" />
                      <p>Content Preview</p>
                    </div>
                  ) : (
                    <div className="text-center text-sm text-gray-500">
                      <FileImage className="h-8 w-8 mx-auto mb-2" />
                      <p>Upload content to see preview</p>
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  disabled
                >
                  <Download className="h-4 w-4 mr-2" />
                  Select ZIP Files
                </Button>
              </div>
              
              {/* Color Palette */}
              <div className="flex-1">
                <div className="flex gap-2 flex-wrap">
                  {colorPalette.map((color, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 bg-white border rounded-lg p-2 shadow-sm"
                    >
                      <div
                        className="w-8 h-8 rounded border"
                        style={{ backgroundColor: color.hex }}
                      />
                      <div className="text-xs">
                        <div className="font-mono font-medium">{color.hex}</div>
                        <div className="text-muted-foreground">{color.name}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI Content Suggestions */}
        {suggestions.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-blue-600">AI Content Suggestions</h3>
            <p className="text-sm text-muted-foreground">
              Based off what we've seen, we have prepared some suggestions for you on how you can improve your profile
            </p>
            <div className="space-y-2">
              {suggestions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
                >
                  <div className="flex-shrink-0">
                    <div className="w-5 h-5 text-blue-600">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                        <path d="M12 2L2 7L12 12L22 7L12 2Z" />
                        <path d="M2 17L12 22L22 17" />
                        <path d="M2 12L12 17L22 12" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-blue-900">{suggestion.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {suggestions.length > 0 && (
          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={resetUpload}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Upload New Content
            </Button>
            <Button
              onClick={generateNewPost}
              disabled={isGenerating}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  AI Generate New Post
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
