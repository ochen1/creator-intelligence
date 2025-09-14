import { NextRequest, NextResponse } from 'next/server'
import { getToolDefinitions, getToolByName } from '@/lib/swarm-tools'
import { executionStore, type ExecutionPlan, type PlanStep } from '@/lib/execution-store'

async function callLLM(query: string, tools: any[]) {
  const apiKey = process.env.OPENAI_API_KEY
  
  if (!apiKey) {
    throw new Error('OpenAI API key not configured')
  }

  const systemPrompt = `You are an intelligent assistant for a creator intelligence platform. Your role is to help creators analyze their Instagram audience data and campaigns.

You have access to tools that can:
1. Find and filter profiles by tags, follower status, and event history
2. Analyze churn patterns for campaigns
3. Get campaign performance metrics
4. Classify profiles using a local AI service
5. Summarize findings and provide strategic recommendations

When given a query, create a step-by-step plan to answer it. Each step should use one of the available tools.

Always end with a "summarize_and_recommend" step to provide actionable insights.

Important guidelines:
- Be specific about what data to analyze
- Use appropriate filters when searching for profiles
- Always provide context for your analysis
- Focus on actionable insights for content creators
- Keep steps focused and avoid redundancy

Create a plan as a JSON array of steps with this structure:
{
  "steps": [
    {
      "id": "step_1",
      "title": "Brief step title",
      "description": "What this step will accomplish",
      "tool_name": "tool_to_use",
      "parameters": { "param1": "value1" }
    }
  ]
}`

//   const response = await fetch('https://api.openai.com/v1/chat/completions', {
  const response = await fetch('http://localhost:4141/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Please create a plan to answer this query: "${query}"` }
      ],
      tools: tools,
      tool_choice: 'auto',
      temperature: 0.1
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`)
  }

  const data = await response.json()
  
  // Try to extract plan from the response
  const messageContent = data.choices[0]?.message?.content
  if (messageContent) {
    try {
      const planMatch = messageContent.match(/```json\s*([\s\S]*?)\s*```/) || 
                       messageContent.match(/\{[\s\S]*"steps"[\s\S]*\}/)
      
      if (planMatch) {
        const planData = JSON.parse(planMatch[1] || planMatch[0])
        return planData.steps || []
      }
    } catch (e) {
      console.error('Failed to parse LLM response:', e)
    }
  }

  // Fallback: create a simple plan
  return [
    {
      id: 'step_1',
      title: 'Find relevant profiles',
      description: 'Search for profiles matching your criteria',
      tool_name: 'find_profiles',
      parameters: { limit: 20 }
    },
    {
      id: 'step_2',
      title: 'Summarize findings',
      description: 'Provide insights and recommendations',
      tool_name: 'summarize_and_recommend',
      parameters: { 
        context: query,
        data: []
      }
    }
  ]
}

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()
    
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    // Generate unique execution ID
    const executionId = Date.now().toString() + Math.random().toString(36).substr(2, 9)
    
    // Create initial execution plan
    const execution: ExecutionPlan = {
      id: executionId,
      query,
      steps: [],
      status: 'generating',
      createdAt: new Date()
    }
    
    executionStore.set(executionId, execution)

    // Start async execution
    executeSwarmPlan(executionId, query).catch(error => {
      console.error('Swarm execution error:', error)
      const exec = executionStore.get(executionId)
      if (exec) {
        exec.status = 'failed'
        executionStore.set(executionId, exec)
      }
    })

    return NextResponse.json({ executionId })
  } catch (error) {
    console.error('Swarm API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function executeSwarmPlan(executionId: string, query: string) {
  const execution = executionStore.get(executionId)
  if (!execution) return

  try {
    // Generate plan using LLM
    const tools = getToolDefinitions()
    const steps = await callLLM(query, tools)
    
    // Update execution with generated plan
    execution.steps = steps.map((step: any) => ({
      ...step,
      status: 'pending' as const
    }))
    execution.status = 'executing'
    executionStore.set(executionId, execution)

    // Execute each step
    let previousResults: any[] = []
    
    for (let i = 0; i < execution.steps.length; i++) {
      const step = execution.steps[i]
      
      // Update step status to in_progress
      step.status = 'in_progress'
      executionStore.set(executionId, execution)
      
      try {
        const tool = getToolByName(step.tool_name || '')
        if (!tool) {
          throw new Error(`Tool ${step.tool_name} not found`)
        }

        // Validate parameters
        let validatedParams = step.parameters || {}
        
        // Special handling for summarize step - pass accumulated data
        if (step.tool_name === 'summarize_and_recommend') {
          validatedParams.data = previousResults
        }

        const result = await tool.execute(validatedParams)
        
        // Update step with result
        step.result = result
        step.status = 'completed'
        previousResults.push(result)
        
        executionStore.set(executionId, execution)
      } catch (error) {
        console.error(`Step ${step.id} failed:`, error)
        step.error = error instanceof Error ? error.message : 'Unknown error'
        step.status = 'failed'
        executionStore.set(executionId, execution)
        
        // Continue with remaining steps even if one fails
      }
    }

    // Mark execution as completed
    execution.status = 'completed'
    
    // Extract final result from last step (usually summarize_and_recommend)
    const lastStep = execution.steps[execution.steps.length - 1]
    if (lastStep?.result?.summary) {
      execution.finalResult = lastStep.result.summary
    }
    
    executionStore.set(executionId, execution)
    
  } catch (error) {
    console.error('Plan execution failed:', error)
    execution.status = 'failed'
    executionStore.set(executionId, execution)
  }
}

// GET endpoint to retrieve execution status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const executionId = searchParams.get('executionId')
  
  if (!executionId) {
    return NextResponse.json({ error: 'Execution ID is required' }, { status: 400 })
  }
  
  const execution = executionStore.get(executionId)
  if (!execution) {
    return NextResponse.json({ error: 'Execution not found' }, { status: 404 })
  }
  
  return NextResponse.json(execution)
}