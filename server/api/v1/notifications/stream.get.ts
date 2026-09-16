import { registerSseClient, unregisterSseClient } from '../../../utils/sse'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as { sub: string }
  const userId = auth.sub

  const stream = createEventStream(event)

  const client = { push: (message: { event?: string; data: string }) => stream.push(message) }
  registerSseClient(userId, client)

  stream.push({ event: 'connected', data: JSON.stringify({ userId }) })

  const heartbeat = setInterval(() => {
    stream.push({ event: 'ping', data: JSON.stringify({ ts: Date.now() }) })
  }, 25000)

  stream.onClosed(async () => {
    clearInterval(heartbeat)
    unregisterSseClient(userId, client)
    await stream.close()
  })

  return stream.send()
})
