import { Test, TestingModule } from '@nestjs/testing';
import { IncidentsService } from '../../src/modules/incidents/incidents.service';
import { DatabaseService } from '../../src/database/database.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EscalationQueueService } from '../../src/queues/escalation.queue';

describe('IncidentsService', () => {
  let service: IncidentsService;
  let dbService: DatabaseService;
  let eventEmitter: EventEmitter2;
  let escalationQueue: EscalationQueueService;

  const mockDb = {
    db: {
      insert: jest.fn(),
      update: jest.fn(),
      query: {
        incidents: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
        },
        services: {
          findFirst: jest.fn(),
        },
        alerts: {
          findMany: jest.fn(),
        },
      },
    },
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  const mockEscalationQueue = {
    scheduleEscalation: jest.fn(),
    cancelEscalation: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentsService,
        {
          provide: DatabaseService,
          useValue: mockDb,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: EscalationQueueService,
          useValue: mockEscalationQueue,
        },
      ],
    }).compile();

    service = module.get<IncidentsService>(IncidentsService);
    dbService = module.get<DatabaseService>(DatabaseService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    escalationQueue = module.get<EscalationQueueService>(EscalationQueueService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOrCreateForAlert', () => {
    it('should return existing triggered incident with same severity', async () => {
      const existingIncident = {
        id: 1,
        serviceId: 1,
        status: 'triggered',
        severity: 'high',
      };

      mockDb.db.query.incidents.findFirst.mockResolvedValue(existingIncident);

      const result = await service.findOrCreateForAlert({
        serviceId: 1,
        title: 'Test Incident',
        severity: 'high',
        alertName: 'Test Alert',
      });

      expect(result).toEqual(existingIncident);
      expect(mockDb.db.insert).not.toHaveBeenCalled();
    });

    it('should create new incident when none exists', async () => {
      const service = {
        id: 1,
        name: 'Test Service',
        escalationPolicyId: 1,
      };

      const newIncident = {
        id: 2,
        incidentNumber: 2,
        title: 'Test Incident',
        status: 'triggered',
        severity: 'high',
        serviceId: 1,
      };

      mockDb.db.query.incidents.findFirst.mockResolvedValue(null);
      mockDb.db.query.services.findFirst.mockResolvedValue(service);
      mockDb.db.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([newIncident]),
        }),
      });

      const result = await service.findOrCreateForAlert({
        serviceId: 1,
        title: 'Test Incident',
        severity: 'high',
        alertName: 'Test Alert',
      });

      expect(result).toEqual(newIncident);
      expect(mockEscalationQueue.scheduleEscalation).toHaveBeenCalledWith(2, 1, 0, 0);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('incident.created', newIncident);
    });
  });

  describe('acknowledge', () => {
    it('should acknowledge incident and cancel escalation', async () => {
      const incident = {
        id: 1,
        status: 'triggered',
        serviceId: 1,
      };

      const acknowledgedIncident = {
        ...incident,
        status: 'acknowledged',
        acknowledgedById: 1,
        acknowledgedAt: expect.any(Date),
      };

      mockDb.db.query.incidents.findFirst.mockResolvedValue(incident);
      mockDb.db.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([acknowledgedIncident]),
          }),
        }),
      });

      const result = await service.acknowledge(1, 1);

      expect(result).toEqual(acknowledgedIncident);
      expect(mockEscalationQueue.cancelEscalation).toHaveBeenCalledWith(1);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('incident.acknowledged', {
        incident: acknowledgedIncident,
        user: { id: 1 },
      });
    });

    it('should throw error if incident not found', async () => {
      mockDb.db.query.incidents.findFirst.mockResolvedValue(null);

      await expect(service.acknowledge(999, 1)).rejects.toThrow('Incident 999 not found');
    });

    it('should not acknowledge already resolved incident', async () => {
      const incident = {
        id: 1,
        status: 'resolved',
      };

      mockDb.db.query.incidents.findFirst.mockResolvedValue(incident);

      await expect(service.acknowledge(1, 1)).rejects.toThrow(
        'Cannot acknowledge resolved incident',
      );
    });
  });

  describe('resolve', () => {
    it('should resolve incident and cancel escalation', async () => {
      const incident = {
        id: 1,
        status: 'acknowledged',
        serviceId: 1,
      };

      const resolvedIncident = {
        ...incident,
        status: 'resolved',
        resolvedById: 1,
        resolvedAt: expect.any(Date),
      };

      mockDb.db.query.incidents.findFirst.mockResolvedValue(incident);
      mockDb.db.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([resolvedIncident]),
          }),
        }),
      });

      const result = await service.resolve(1, 1);

      expect(result).toEqual(resolvedIncident);
      expect(mockEscalationQueue.cancelEscalation).toHaveBeenCalledWith(1);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('incident.resolved', {
        incident: resolvedIncident,
        user: { id: 1 },
      });
    });
  });

  describe('autoResolveIfAllAlertsResolved', () => {
    it('should resolve incident if all alerts are resolved', async () => {
      const incident = {
        id: 1,
        status: 'triggered',
      };

      const alerts = [
        { id: 1, status: 'resolved' },
        { id: 2, status: 'resolved' },
      ];

      mockDb.db.query.incidents.findFirst.mockResolvedValue(incident);
      mockDb.db.query.alerts.findMany.mockResolvedValue(alerts);
      mockDb.db.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([{ ...incident, status: 'resolved' }]),
          }),
        }),
      });

      await service.autoResolveIfAllAlertsResolved(1);

      expect(mockEscalationQueue.cancelEscalation).toHaveBeenCalledWith(1);
    });

    it('should not resolve incident if some alerts are still firing', async () => {
      const incident = {
        id: 1,
        status: 'triggered',
      };

      const alerts = [
        { id: 1, status: 'resolved' },
        { id: 2, status: 'firing' }, // Still firing
      ];

      mockDb.db.query.incidents.findFirst.mockResolvedValue(incident);
      mockDb.db.query.alerts.findMany.mockResolvedValue(alerts);

      await service.autoResolveIfAllAlertsResolved(1);

      expect(mockDb.db.update).not.toHaveBeenCalled();
      expect(mockEscalationQueue.cancelEscalation).not.toHaveBeenCalled();
    });
  });
});
