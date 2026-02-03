import { Test, TestingModule } from '@nestjs/testing';
import { AlertsService } from '../../src/modules/alerts/alerts.service';
import { IncidentsService } from '../../src/modules/incidents/incidents.service';
import { DatabaseService } from '../../src/database/database.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AlertStatus, AlertSeverity } from '../../src/modules/alerts/dto/create-alert.dto';

describe('AlertsService', () => {
  let service: AlertsService;
  let incidentsService: IncidentsService;
  let dbService: DatabaseService;
  let eventEmitter: EventEmitter2;

  const mockDb = {
    db: {
      insert: jest.fn(),
      update: jest.fn(),
      query: {
        integrations: {
          findFirst: jest.fn(),
        },
        alerts: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
        },
      },
    },
  };

  const mockIncidentsService = {
    findOrCreateForAlert: jest.fn(),
    autoResolveIfAllAlertsResolved: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertsService,
        {
          provide: DatabaseService,
          useValue: mockDb,
        },
        {
          provide: IncidentsService,
          useValue: mockIncidentsService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<AlertsService>(AlertsService);
    incidentsService = module.get<IncidentsService>(IncidentsService);
    dbService = module.get<DatabaseService>(DatabaseService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('ingestAlert', () => {
    it('should validate integration exists', async () => {
      mockDb.db.query.integrations.findFirst.mockResolvedValue(null);

      await expect(
        service.ingestAlert('invalid-key', {
          alertName: 'Test Alert',
          status: 'firing',
          severity: 'high',
          source: 'test',
          labels: {},
        }),
      ).rejects.toThrow('Invalid or inactive integration');
    });

    it('should deduplicate existing firing alerts', async () => {
      const integration = {
        id: 1,
        integrationKey: 'test-key',
        isActive: true,
        service: { id: 1, name: 'Test Service', teamId: 1 },
      };

      const existingAlert = {
        id: 1,
        fingerprint: 'abc123',
        status: 'firing',
      };

      mockDb.db.query.integrations.findFirst.mockResolvedValue(integration);
      mockDb.db.query.alerts.findFirst.mockResolvedValue(existingAlert);

      const result = await service.ingestAlert('test-key', {
        alertName: 'Test Alert',
        status: AlertStatus.FIRING,
        severity: AlertSeverity.HIGH,
        source: 'test',
        labels: {},
      });

      expect(result).toEqual(existingAlert);
      expect(mockDb.db.insert).not.toHaveBeenCalled();
    });

    it('should create new alert when no duplicate exists', async () => {
      const integration = {
        id: 1,
        integrationKey: 'test-key',
        isActive: true,
        service: { id: 1, name: 'Test Service', teamId: 1, escalationPolicyId: 1 },
      };

      const incident = {
        id: 1,
        incidentNumber: 1,
        status: 'triggered',
      };

      const newAlert = {
        id: 2,
        alertName: 'Test Alert',
        status: AlertStatus.FIRING,
        severity: AlertSeverity.HIGH,
      };

      mockDb.db.query.integrations.findFirst.mockResolvedValue(integration);
      mockDb.db.query.alerts.findFirst.mockResolvedValue(null);
      mockIncidentsService.findOrCreateForAlert.mockResolvedValue(incident);
      mockDb.db.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([newAlert]),
        }),
      });

      const result = await service.ingestAlert('test-key', {
        alertName: 'Test Alert',
        status: AlertStatus.FIRING,
        severity: AlertSeverity.HIGH,
        source: 'test',
        labels: {},
      });

      expect(result).toEqual(newAlert);
      expect(mockIncidentsService.findOrCreateForAlert).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('alert.created', newAlert);
    });

    it('should handle resolved status and auto-resolve incidents', async () => {
      const integration = {
        id: 1,
        integrationKey: 'test-key',
        isActive: true,
        service: { id: 1, name: 'Test Service', teamId: 1 },
      };

      const existingAlert = {
        id: 1,
        fingerprint: 'abc123',
        status: 'firing',
        incidentId: 1,
      };

      mockDb.db.query.integrations.findFirst.mockResolvedValue(integration);
      mockDb.db.query.alerts.findFirst.mockResolvedValue(existingAlert);
      mockDb.db.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([{ ...existingAlert, status: 'resolved' }]),
          }),
        }),
      });

      await service.ingestAlert('test-key', {
        alertName: 'Test Alert',
        status: AlertStatus.RESOLVED,
        severity: 'high',
        source: 'test',
        labels: {},
      });

      expect(mockIncidentsService.autoResolveIfAllAlertsResolved).toHaveBeenCalledWith(1);
    });
  });

  describe('generateFingerprint', () => {
    it('should generate consistent fingerprint for same alert', () => {
      const payload1 = {
        alertName: 'Test Alert',
        source: 'prometheus',
        labels: { env: 'prod', host: 'server1' },
      };

      const payload2 = {
        alertName: 'Test Alert',
        source: 'prometheus',
        labels: { host: 'server1', env: 'prod' }, // Different order
      };

      const fingerprint1 = (service as any).generateFingerprint(payload1);
      const fingerprint2 = (service as any).generateFingerprint(payload2);

      expect(fingerprint1).toEqual(fingerprint2);
      expect(fingerprint1).toHaveLength(64);
    });

    it('should generate different fingerprints for different alerts', () => {
      const payload1 = {
        alertName: 'Test Alert 1',
        source: 'prometheus',
        labels: {},
      };

      const payload2 = {
        alertName: 'Test Alert 2',
        source: 'prometheus',
        labels: {},
      };

      const fingerprint1 = (service as any).generateFingerprint(payload1);
      const fingerprint2 = (service as any).generateFingerprint(payload2);

      expect(fingerprint1).not.toEqual(fingerprint2);
    });
  });
});
