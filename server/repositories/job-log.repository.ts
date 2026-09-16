import { desc, eq } from 'drizzle-orm'
import { db } from '../db/client'
import { jobExecutionLogs } from '../db/schema'

export function createJobLog(values: {
  job_name: string
  status: string
  rows_processed?: number | null
  duration_ms?: number | null
  error_message?: string | null
  executed_at: Date
}) {
  return db.insert(jobExecutionLogs).values(values).returning()
}

export function listJobLogs(jobName?: string) {
  const query = db.select().from(jobExecutionLogs)
  if (jobName) {
    return query.where(eq(jobExecutionLogs.job_name, jobName)).orderBy(desc(jobExecutionLogs.executed_at))
  }
  return query.orderBy(desc(jobExecutionLogs.executed_at))
}
