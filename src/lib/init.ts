// Initialize backend services
import { wsServer } from './websocket-server'

let initialized = false

export function initializeServices() {
  if (initialized) {
    console.log('StreamingRange services already initialized')
    return
  }
  
  console.log('Initializing StreamingRange services...')
  
  // Only start WebSocket server in development and if not already running
  if (process.env.NODE_ENV === 'development') {
    try {
      wsServer.start(8080)
    } catch (error) {
      console.log('WebSocket server start failed (likely already running):', error)
    }
  }
  
  initialized = true
  console.log('Services initialized')
}

// Auto-initialize with delay to avoid conflicts
if (typeof window === 'undefined') {
  setTimeout(() => {
    initializeServices()
  }, 1000)
}