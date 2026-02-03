import { io, Socket } from 'socket.io-client'
import type { Incident, Alert } from '@/types/api'

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

class SocketClient {
  private socket: Socket | null = null
  private listeners: Map<string, Set<(data: any) => void>> = new Map()

  connect() {
    if (this.socket?.connected) return this.socket

    this.socket = io(`${SOCKET_URL}/incidents`, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    })

    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected:', this.socket?.id)
    })

    this.socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason)
    })

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error)
    })

    return this.socket
  }

  disconnect() {
    this.socket?.disconnect()
    this.socket = null
    this.listeners.clear()
  }

  on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)?.add(callback)

    this.socket?.on(event, callback)
  }

  off(event: string, callback?: (data: any) => void) {
    if (callback) {
      this.listeners.get(event)?.delete(callback)
      this.socket?.off(event, callback)
    } else {
      this.listeners.delete(event)
      this.socket?.off(event)
    }
  }

  emit(event: string, data?: any) {
    this.socket?.emit(event, data)
  }

  subscribeToIncident(incidentId: number) {
    this.emit('subscribe:incident', incidentId)
  }

  unsubscribeFromIncident(incidentId: number) {
    this.emit('unsubscribe:incident', incidentId)
  }

  onIncidentCreated(callback: (incident: Incident) => void) {
    this.on('incident:created', callback)
  }

  onIncidentUpdated(callback: (incident: Incident) => void) {
    this.on('incident:updated', callback)
  }

  onIncidentAcknowledged(callback: (data: { incident: Incident; user: any }) => void) {
    this.on('incident:acknowledged', callback)
  }

  onIncidentResolved(callback: (data: { incident: Incident; user: any }) => void) {
    this.on('incident:resolved', callback)
  }

  onAlertCreated(callback: (alert: Alert) => void) {
    this.on('alert:created', callback)
  }

  get isConnected(): boolean {
    return this.socket?.connected || false
  }
}

export const socketClient = new SocketClient()
export default socketClient
