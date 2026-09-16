import { runMovementClassificationJob } from '../jobs/movement-classification.job'

export default defineTask({
  meta: {
    name: 'movement-classification',
    description: 'Daily: classify every product+warehouse as fast/normal/slow/dead (PRD §6.5)',
  },
  async run() {
    const result = await runMovementClassificationJob()
    return { result }
  },
})
