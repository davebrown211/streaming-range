// Simple polling service for development
let pollingInterval: NodeJS.Timeout | null = null

export function startPolling(intervalMinutes: number = 60) {
  if (pollingInterval) {
    console.log('Polling already running')
    return
  }

  console.log(`Starting view count polling every ${intervalMinutes} minutes`)
  
  // Initial run
  pollNow()
  
  // Set up interval
  pollingInterval = setInterval(() => {
    pollNow()
  }, intervalMinutes * 60 * 1000)
}

export function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval)
    pollingInterval = null
    console.log('Polling stopped')
  }
}

async function pollNow() {
  try {
    console.log('Polling view counts...', new Date().toISOString())
    
    const response = await fetch('/api/update-acceleration', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    if (response.ok) {
      const result = await response.json()
      console.log('Polling successful:', result)
    } else {
      console.error('Polling failed:', response.status, response.statusText)
    }
  } catch (error) {
    console.error('Polling error:', error)
  }
}

// Auto-start disabled - scheduler now handles view updates
// if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
//   // Start polling every hour in development
//   setTimeout(() => startPolling(60), 5000) // 5 second delay to let app start
// }