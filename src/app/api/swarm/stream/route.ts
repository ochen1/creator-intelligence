import { NextRequest } from 'next/server'
import { executionStore } from '@/lib/execution-store'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const executionId = searchParams.get('executionId')
  
  if (!executionId) {
    return new Response('Execution ID is required', { status: 400 })
  }

  // Create SSE stream
  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    start(controller) {
      let lastStatus = ''
      let lastStepsLength = 0
      
      // Poll for updates
      const interval = setInterval(() => {
        const execution = executionStore.get(executionId)
        
        if (!execution) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'execution_failed',
            error: 'Execution not found'
          })}\n\n`))
          controller.close()
          clearInterval(interval)
          return
        }

        // Send plan generation update
        if (execution.status === 'executing' && lastStatus !== 'executing') {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'plan_generated',
            plan: execution
          })}\n\n`))
          lastStatus = 'executing'
          lastStepsLength = execution.steps?.length || 0
        }

        // Send step updates
        if (execution.steps && execution.steps.length > 0) {
          execution.steps.forEach((step: any, index: number) => {
            const stepKey = `${step.id}_${step.status}`
            if (!step._lastSent || step._lastSent !== stepKey) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'step_update',
                stepId: step.id,
                status: step.status,
                result: step.result,
                error: step.error
              })}\n\n`))
              step._lastSent = stepKey
            }
          })
        }

        // Send completion update
        if (execution.status === 'completed' && lastStatus !== 'completed') {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'execution_complete',
            finalResult: execution.finalResult
          })}\n\n`))
          controller.close()
          clearInterval(interval)
          return
        }

        // Send failure update
        if (execution.status === 'failed' && lastStatus !== 'failed') {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'execution_failed',
            error: 'Execution failed'
          })}\n\n`))
          controller.close()
          clearInterval(interval)
          return
        }
      }, 500) // Poll every 500ms

      // Clean up after 5 minutes
      setTimeout(() => {
        clearInterval(interval)
        controller.close()
      }, 5 * 60 * 1000)
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    }
  })
}