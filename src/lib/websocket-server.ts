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

  start(port: number = 8080) {
    if (this.wss) {
      console.log('WebSocket server already running')
      return
    }

    const server = createServer()
    this.wss = new WebSocketServer({ server })

    this.wss.on('connection', (ws) => {
      console.log('Client connected to WebSocket')
      this.clients.add(ws)

      // Send initial connection message
      this.sendToClient(ws, {
        type: 'stats_update',
        data: { message: 'Connected to Golf Directory live updates' },
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

    server.listen(port, () => {
      console.log(`WebSocket server running on port ${port}`)
    })
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

  broadcastRankingUpdate(rankingType: string, rankings: any[]) {
    this.broadcast({
      type: 'ranking_update',
      data: { rankingType, rankings },
      timestamp: new Date().toISOString()
    })
  }

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
    if (this.wss) {
      this.wss.close()
      this.wss = null
      this.clients.clear()
      console.log('WebSocket server stopped')
    }
  }
}

// Singleton instance
export const wsServer = new GolfDirectoryWebSocketServer()

// Auto-start in development
if (process.env.NODE_ENV === 'development') {
  wsServer.start(8080)
}