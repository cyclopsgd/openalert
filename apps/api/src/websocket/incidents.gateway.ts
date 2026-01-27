import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards, Logger } from '@nestjs/common';
import { WsJwtGuard } from '../common/guards/ws-jwt.guard';
import { OnEvent } from '@nestjs/event-emitter';

interface AuthenticatedSocket extends Socket {
  userId: number;
  teamIds: number[];
}

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: 'incidents',
})
export class IncidentsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(IncidentsGateway.name);

  @WebSocketServer()
  server: Server;

  async handleConnection(client: AuthenticatedSocket) {
    this.logger.log(`Client connected: ${client.id}`);

    // Auto-join user's team rooms
    if (client.teamIds) {
      for (const teamId of client.teamIds) {
        client.join(`team:${teamId}`);
      }
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('subscribe:incident')
  handleSubscribeIncident(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() incidentId: number,
  ) {
    client.join(`incident:${incidentId}`);
    return { event: 'subscribed', data: { incidentId } };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('unsubscribe:incident')
  handleUnsubscribeIncident(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() incidentId: number,
  ) {
    client.leave(`incident:${incidentId}`);
    return { event: 'unsubscribed', data: { incidentId } };
  }

  // Event handlers for broadcasting updates
  @OnEvent('incident.created')
  handleIncidentCreated(incident: any) {
    this.server.to(`team:${incident.teamId}`).emit('incident:created', incident);
  }

  @OnEvent('incident.updated')
  handleIncidentUpdated(incident: any) {
    this.server.to(`incident:${incident.id}`).emit('incident:updated', incident);
    this.server.to(`team:${incident.teamId}`).emit('incident:updated', incident);
  }

  @OnEvent('incident.acknowledged')
  handleIncidentAcknowledged(data: { incident: any; user: any }) {
    this.server.to(`incident:${data.incident.id}`).emit('incident:acknowledged', data);
  }

  @OnEvent('incident.resolved')
  handleIncidentResolved(data: { incident: any; user: any }) {
    this.server.to(`incident:${data.incident.id}`).emit('incident:resolved', data);
  }

  @OnEvent('alert.created')
  handleAlertCreated(alert: any) {
    if (alert.incidentId) {
      this.server.to(`incident:${alert.incidentId}`).emit('alert:created', alert);
    }
  }

  @OnEvent('alert.acknowledged')
  handleAlertAcknowledged(data: { alert: any; user: any }) {
    if (data.alert.incidentId) {
      this.server.to(`incident:${data.alert.incidentId}`).emit('alert:acknowledged', data);
    }
  }

  @OnEvent('alert.resolved')
  handleAlertResolved(alert: any) {
    if (alert.incidentId) {
      this.server.to(`incident:${alert.incidentId}`).emit('alert:resolved', alert);
    }
  }
}
