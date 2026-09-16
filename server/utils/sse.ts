interface SseClient {
  push: (message: { event?: string; data: string }) => Promise<void>
}

const clientsByUser = new Map<string, Set<SseClient>>()

export function registerSseClient(userId: string, client: SseClient) {
  if (!clientsByUser.has(userId)) clientsByUser.set(userId, new Set())
  clientsByUser.get(userId)!.add(client)
}

export function unregisterSseClient(userId: string, client: SseClient) {
  const set = clientsByUser.get(userId)
  if (!set) return
  set.delete(client)
  if (set.size === 0) clientsByUser.delete(userId)
}

export function sendToUser(userId: string, event: string, data: unknown) {
  const set = clientsByUser.get(userId)
  if (!set) return
  for (const client of set) {
    client.push({ event, data: JSON.stringify(data) })
  }
}
