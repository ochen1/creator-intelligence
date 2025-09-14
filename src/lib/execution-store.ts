// Shared execution store for swarm operations
// In production, this should be replaced with Redis or a database

interface PlanStep {
  id: string
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  tool_name?: string
  parameters?: any
  result?: any
  error?: string
  _lastSent?: string // For SSE tracking
}

interface ExecutionPlan {
  id: string
  query: string
  steps: PlanStep[]
  status: 'generating' | 'executing' | 'completed' | 'failed'
  finalResult?: string
  createdAt: Date
}

class ExecutionStore {
  private executions = new Map<string, ExecutionPlan>()

  set(id: string, execution: ExecutionPlan) {
    this.executions.set(id, execution)
  }

  get(id: string): ExecutionPlan | undefined {
    return this.executions.get(id)
  }

  has(id: string): boolean {
    return this.executions.has(id)
  }

  delete(id: string): boolean {
    return this.executions.delete(id)
  }

  // Clean up old executions (older than 1 hour)
  cleanup() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    for (const [id, execution] of this.executions.entries()) {
      if (execution.createdAt < oneHourAgo) {
        this.executions.delete(id)
      }
    }
  }
}

// Global store instance
export const executionStore = new ExecutionStore()

// Cleanup old executions every 30 minutes
setInterval(() => {
  executionStore.cleanup()
}, 30 * 60 * 1000)

export type { ExecutionPlan, PlanStep }