'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Terminal, Send, CheckCircle, AlertCircle, Clock, Loader2 } from 'lucide-react'

export interface PlanStep {
  id: string
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  result?: any
  error?: string
}

export interface SwarmPlan {
  id: string
  query: string
  steps: PlanStep[]
  status: 'generating' | 'executing' | 'completed' | 'failed'
  finalResult?: string
}

export function SwarmCommand() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [currentPlan, setCurrentPlan] = useState<SwarmPlan | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim() || isSubmitting) return

    setIsSubmitting(true)
    setCurrentPlan({
      id: Date.now().toString(),
      query,
      steps: [],
      status: 'generating'
    })

    try {
      // Start the swarm execution
      const response = await fetch('/api/swarm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      })

      if (!response.ok) {
        throw new Error('Failed to start swarm execution')
      }

      const { executionId } = await response.json()

      // Set up SSE connection for real-time updates
      eventSourceRef.current = new EventSource(`/api/swarm/stream?executionId=${executionId}`)
      
      eventSourceRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data)
        
        if (data.type === 'plan_generated') {
          setCurrentPlan(prev => prev ? {
            ...prev,
            steps: data.plan.steps,
            status: 'executing'
          } : null)
        } else if (data.type === 'step_update') {
          setCurrentPlan(prev => prev ? {
            ...prev,
            steps: prev.steps.map(step => 
              step.id === data.stepId 
                ? { ...step, status: data.status, result: data.result, error: data.error }
                : step
            )
          } : null)
        } else if (data.type === 'execution_complete') {
          setCurrentPlan(prev => prev ? {
            ...prev,
            status: 'completed',
            finalResult: data.finalResult
          } : null)
          eventSourceRef.current?.close()
          setIsSubmitting(false)
        } else if (data.type === 'execution_failed') {
          setCurrentPlan(prev => prev ? {
            ...prev,
            status: 'failed'
          } : null)
          eventSourceRef.current?.close()
          setIsSubmitting(false)
        }
      }

      eventSourceRef.current.onerror = () => {
        setCurrentPlan(prev => prev ? {
          ...prev,
          status: 'failed'
        } : null)
        eventSourceRef.current?.close()
        setIsSubmitting(false)
      }

    } catch (error) {
      console.error('Error starting swarm execution:', error)
      setCurrentPlan(prev => prev ? {
        ...prev,
        status: 'failed'
      } : null)
      setIsSubmitting(false)
    }
  }

  const resetCommand = () => {
    setQuery('')
    setCurrentPlan(null)
    setIsSubmitting(false)
    eventSourceRef.current?.close()
  }

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close()
    }
  }, [])

  const getStatusIcon = (status: PlanStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'in_progress':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusBadge = (status: SwarmPlan['status']) => {
    switch (status) {
      case 'generating':
        return <Badge variant="secondary">Generating Plan...</Badge>
      case 'executing':
        return <Badge variant="default">Executing</Badge>
      case 'completed':
        return <Badge variant="default" className="bg-green-500">Completed</Badge>
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Terminal className="w-4 h-4" />
          Swarm Command
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="w-5 h-5" />
            Swarm Command Interface
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-4">
          {/* Query Input */}
          <form onSubmit={handleSubmit} className="space-y-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask me anything about your audience data... e.g., 'Show me followers from my last campaign who are interested in golf'"
              disabled={isSubmitting}
              className="w-full"
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={isSubmitting || !query.trim()} className="gap-2">
                <Send className="w-4 h-4" />
                Execute
              </Button>
              {currentPlan && (
                <Button type="button" variant="outline" onClick={resetCommand}>
                  New Query
                </Button>
              )}
            </div>
          </form>

          {/* Plan Visualization */}
          {currentPlan && (
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Execution Plan</h3>
                {getStatusBadge(currentPlan.status)}
              </div>
              
              <div className="text-sm text-muted-foreground border-l-2 border-blue-200 pl-3">
                Query: {currentPlan.query}
              </div>

              {currentPlan.steps.length > 0 && (
                <ScrollArea className="max-h-60">
                  <div className="space-y-2">
                    {currentPlan.steps.map((step, index) => (
                      <div key={step.id} className="flex items-start gap-3 p-2 rounded border">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-xs font-mono text-muted-foreground">
                            {index + 1}.
                          </span>
                          {getStatusIcon(step.status)}
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-sm">{step.title}</div>
                            <div className="text-xs text-muted-foreground">{step.description}</div>
                            {step.error && (
                              <div className="text-xs text-red-500 mt-1">Error: {step.error}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}

              {currentPlan.finalResult && (
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-2">Result:</h4>
                  <div className="bg-muted p-3 rounded text-sm whitespace-pre-wrap">
                    {currentPlan.finalResult}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}