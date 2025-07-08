'use client'

import { useEffect, useRef, useState } from 'react'

export interface WebSocketMessage {
  type: 'ranking_update' | 'stats_update' | 'new_video' | 'acceleration_update'
  data: any
  timestamp: string
}

export function useWebSocket(url: string = 'ws://localhost:8080') {
  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ws = useRef<WebSocket | null>(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5

  const connect = () => {
    try {
      ws.current = new WebSocket(url)

      ws.current.onopen = () => {
        console.log('WebSocket connected')
        setIsConnected(true)
        setError(null)
        reconnectAttempts.current = 0
      }

      ws.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          setLastMessage(message)
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err)
        }
      }

      ws.current.onclose = () => {
        console.log('WebSocket disconnected')
        setIsConnected(false)
        
        // Attempt to reconnect
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++
          console.log(`Reconnecting... attempt ${reconnectAttempts.current}`)
          setTimeout(connect, 2000 * reconnectAttempts.current) // Exponential backoff
        } else {
          setError('Failed to reconnect to live updates')
        }
      }

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error)
        setError('WebSocket connection error')
      }
    } catch (err) {
      console.error('Failed to create WebSocket connection:', err)
      setError('Failed to connect to live updates')
    }
  }

  useEffect(() => {
    connect()

    return () => {
      if (ws.current) {
        ws.current.close()
      }
    }
  }, [url])

  const sendMessage = (message: any) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message))
    }
  }

  return {
    isConnected,
    lastMessage,
    error,
    sendMessage
  }
}

// Specialized hooks for different message types
export function useRankingUpdates() {
  const { lastMessage, isConnected, error } = useWebSocket()
  const [rankings, setRankings] = useState<Record<string, any[]>>({})

  useEffect(() => {
    if (lastMessage?.type === 'ranking_update') {
      const { rankingType, rankings: newRankings } = lastMessage.data
      setRankings(prev => ({
        ...prev,
        [rankingType]: newRankings
      }))
    }
  }, [lastMessage])

  return { rankings, isConnected, error }
}

export function useStatsUpdates() {
  const { lastMessage, isConnected, error } = useWebSocket()
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    if (lastMessage?.type === 'stats_update') {
      setStats(lastMessage.data)
    }
  }, [lastMessage])

  return { stats, isConnected, error }
}