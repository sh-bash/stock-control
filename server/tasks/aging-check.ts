import { runAgingCheckJob } from '../jobs/aging-check.job'

export default defineTask({
  meta: {
    name: 'aging-check',
    description: 'Daily: notify when stock_layers cross aging_warning_days / aging_danger_days',
  },
  async run() {
    const result = await runAgingCheckJob()
    return { result }
  },
})
