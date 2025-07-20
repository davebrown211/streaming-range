import { WebSocketServer, WebSocket } from 'ws'
import { createServer } from 'http'

export interface WebSocketMessage {
  type: 'ranking_update' | 'stats_update' | 'new_video' | 'acceleration_update'
  data: any
  timestamp: string
}

class GolfDirectoryWebSocketServer {
  private wss: WebSocketServer | null = null
  private clients: Set<WebSocket> = new Set()
  private server: any = null
  private isStarting = false

  start(port: number = 8080) {
    if (this.wss || this.isStarting) {
      console.log('WebSocket server already running or starting')
      return
    }

    this.isStarting = true

    // Clean up any existing server first
    this.cleanup()

    try {
      this.server = createServer()
      this.wss = new WebSocketServer({ server: this.server })
    } catch (error) {
      console.error('Error creating WebSocket server:', error)
      this.isStarting = false
      return
    }

    this.wss.on('connection', (ws) => {
      console.log('Client connected to WebSocket')
      this.clients.add(ws)

      // Send initial connection message
      this.sendToClient(ws, {
        type: 'stats_update',
        data: { message: 'Connected to StreamingRange live updates' },
        timestamp: new Date().toISOString()
      })

      ws.on('close', () => {
        console.log('Client disconnected from WebSocket')
        this.clients.delete(ws)
      })

      ws.on('error', (error) => {
        console.error('WebSocket error:', error)
        this.clients.delete(ws)
      })
    })

    this.server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.log(`Port ${port} is already in use, WebSocket server not started`)
        this.cleanup()
      } else {
        console.error('WebSocket server error:', error)
        this.cleanup()
      }
    })

    try {
      this.server.listen(port, () => {
        console.log(`WebSocket server running on port ${port}`)
        this.isStarting = false
      })
    } catch (error) {
      console.error('Failed to start WebSocket server:', error)
      this.cleanup()
    }
  }

  private sendToClient(ws: WebSocket, message: WebSocketMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message))
    }
  }

  broadcast(message: WebSocketMessage) {
    console.log(`Broadcasting to ${this.clients.size} clients:`, message.type)
    
    this.clients.forEach((client) => {
      this.sendToClient(client, message)
    })
  }

  // Ranking updates completely removed - focusing on view count updates only

  broadcastStatsUpdate(stats: any) {
    this.broadcast({
      type: 'stats_update',
      data: stats,
      timestamp: new Date().toISOString()
    })
  }

  broadcastAccelerationUpdate(videoId: string, acceleration: number, velocity: number) {
    this.broadcast({
      type: 'acceleration_update',
      data: { videoId, acceleration, velocity },
      timestamp: new Date().toISOString()
    })
  }

  stop() {
    this.cleanup()
    console.log('WebSocket server stopped')
  }

  private cleanup() {
    try {
      if (this.wss) {
        this.wss.close(() => {
          console.log('WebSocket server closed')
        })
        this.wss = null
      }
      if (this.server) {
        this.server.close(() => {
          console.log('HTTP server closed')
        })
        this.server = null
      }
      this.clients.clear()
      this.isStarting = false
    } catch (error) {
      console.error('Error during cleanup:', error)
      // Force reset even if cleanup fails
      this.wss = null
      this.server = null
      this.clients.clear()
      this.isStarting = false
    }
  }
}

// Singleton instance
export const wsServer = new GolfDirectoryWebSocketServer()

// Cleanup on process exit
process.on('SIGTERM', () => {
  console.log('SIGTERM received, cleaning up WebSocket server')
  wsServer.stop()
})

process.on('SIGINT', () => {
  console.log('SIGINT received, cleaning up WebSocket server')
  wsServer.stop()
})

process.on('exit', () => {
  wsServer.stop()
})

// Note: WebSocket server is started by init.ts to avoid conflicts