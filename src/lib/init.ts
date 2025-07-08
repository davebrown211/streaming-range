// Initialize backend services
import { scheduler } from './scheduler'
import { wsServer } from './websocket-server'

let initialized = false

export function initializeServices() {
  if (initialized) return
  
  console.log('Initializing Golf Directory services...')
  
  // Start WebSocket server
  if (process.env.NODE_ENV === 'development') {
    wsServer.start(8080)
  }
  
  // Start scheduler (it has its own production/dev logic)
  // scheduler.start() is called automatically in the scheduler module
  
  initialized = true
  console.log('Services initialized')
}

// Auto-initialize
initializeServices()