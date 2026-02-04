import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StatusPageIncidentsService } from './incidents.service';
import { DatabaseService } from '../../database/database.service';

describe('StatusPageIncidentsService', () => {
  let service: StatusPageIncidentsService;
  let db: DatabaseService;
  let eventEmitter: EventEmitter2;

  const mockInsert = jest.fn().mockReturnThis();
  const mockValues = jest.fn().mockReturnThis();
  const mockReturning = jest.fn();
  const mockUpdate = jest.fn().mockReturnThis();
  const mockSet = jest.fn().mockReturnThis();
  const mockWhere = jest.fn().mockReturnThis();
  const mockDelete = jest.fn().mockReturnThis();

  const mockDb = {
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    query: {
      statusPageIncidents: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      statusPageUpdates: {
        findMany: jest.fn(),
      },
    },
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatusPageIncidentsService,
        {
          provide: DatabaseService,
          useValue: { db: mockDb },
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<StatusPageIncidentsService>(StatusPageIncidentsService);
    db = module.get<DatabaseService>(DatabaseService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);

    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ returning: mockReturning });
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ returning: mockReturning });
    mockDelete.mockReturnValue({ where: mockWhere });
  });

  describe('createIncident', () => {
    it('should create a new incident', async () => {
      const dto = {
        statusPageId: 1,
        title: 'Database Outage',
        status: 'investigating' as const,
        impact: 'major' as const,
        componentIds: [1, 2],
      };

      const mockIncident = {
        id: 1,
        ...dto,
        createdAt: new Date(),
        updatedAt: new Date(),
        resolvedAt: null,
      };

      mockReturning.mockResolvedValueOnce([mockIncident]);
      mockDb.query.statusPageIncidents.findFirst.mockResolvedValue({
        ...mockIncident,
        statusPage: { id: 1 },
        updates: [],
      });

      const result = await service.createIncident(dto);

      expect(result.title).toBe('Database Outage');
      expect(mockInsert).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'statuspage.incident.created',
        mockIncident,
      );
    });

    it('should default status to investigating', async () => {
      const dto = {
        statusPageId: 1,
        title: 'Issue',
      };

      mockReturning.mockResolvedValueOnce([
        {
          id: 1,
          ...dto,
          status: 'investigating',
        },
      ]);
      mockDb.query.statusPageIncidents.findFirst.mockResolvedValue({
        id: 1,
        ...dto,
        status: 'investigating',
        updates: [],
      });

      await service.createIncident(dto);

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'investigating',
        }),
      );
    });

    it('should default impact to minor', async () => {
      const dto = {
        statusPageId: 1,
        title: 'Minor Issue',
      };

      mockReturning.mockResolvedValueOnce([
        {
          id: 1,
          ...dto,
          impact: 'minor',
        },
      ]);
      mockDb.query.statusPageIncidents.findFirst.mockResolvedValue({
        id: 1,
        ...dto,
        impact: 'minor',
        updates: [],
      });

      await service.createIncident(dto);

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          impact: 'minor',
        }),
      );
    });
  });

  describe('findIncidentById', () => {
    it('should return incident with status page and updates', async () => {
      const mockIncident = {
        id: 1,
        title: 'Database Issue',
        status: 'monitoring',
        statusPage: { id: 1, name: 'Status Page' },
        updates: [
          { id: 1, message: 'Investigating', createdAt: new Date() },
          { id: 2, message: 'Fix deployed', createdAt: new Date() },
        ],
      };

      mockDb.query.statusPageIncidents.findFirst.mockResolvedValue(mockIncident);

      const result = await service.findIncidentById(1);

      expect(result).toEqual(mockIncident);
      expect(result.updates).toHaveLength(2);
    });

    it('should throw NotFoundException if incident not found', async () => {
      mockDb.query.statusPageIncidents.findFirst.mockResolvedValue(null);

      await expect(service.findIncidentById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByStatusPage', () => {
    it('should return unresolved incidents by default', async () => {
      const mockIncidents = [
        {
          id: 1,
          title: 'Active Issue',
          resolvedAt: null,
          updates: [{ id: 1, message: 'Latest update' }],
        },
      ];

      mockDb.query.statusPageIncidents.findMany.mockResolvedValue(mockIncidents);

      const result = await service.findByStatusPage(1);

      expect(result).toEqual(mockIncidents);
    });

    it('should include resolved incidents when requested', async () => {
      const mockIncidents = [
        { id: 1, title: 'Issue 1', resolvedAt: null },
        { id: 2, title: 'Issue 2', resolvedAt: new Date() },
      ];

      mockDb.query.statusPageIncidents.findMany.mockResolvedValue(mockIncidents);

      const result = await service.findByStatusPage(1, { includeResolved: true });

      expect(result).toHaveLength(2);
    });

    it('should apply limit', async () => {
      mockDb.query.statusPageIncidents.findMany.mockResolvedValue([]);

      await service.findByStatusPage(1, { limit: 10 });

      expect(mockDb.query.statusPageIncidents.findMany).toHaveBeenCalled();
    });
  });

  describe('updateIncident', () => {
    it('should update incident', async () => {
      const dto = {
        title: 'Updated Title',
        status: 'monitoring' as const,
      };

      const mockUpdated = {
        id: 1,
        ...dto,
        statusPageId: 1,
        updatedAt: new Date(),
      };

      mockReturning.mockResolvedValueOnce([mockUpdated]);
      mockDb.query.statusPageIncidents.findFirst.mockResolvedValue({
        ...mockUpdated,
        updates: [],
      });

      const result = await service.updateIncident(1, dto);

      expect(result.title).toBe('Updated Title');
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('statuspage.incident.updated', mockUpdated);
    });

    it('should set resolvedAt when status is resolved', async () => {
      const dto = {
        status: 'resolved' as const,
      };

      mockReturning.mockResolvedValueOnce([
        {
          id: 1,
          status: 'resolved',
          resolvedAt: expect.any(Date),
        },
      ]);
      mockDb.query.statusPageIncidents.findFirst.mockResolvedValue({
        id: 1,
        status: 'resolved',
        updates: [],
      });

      await service.updateIncident(1, dto);

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          resolvedAt: expect.any(Date),
        }),
      );
    });

    it('should throw NotFoundException if incident not found', async () => {
      mockReturning.mockResolvedValue([]);

      await expect(service.updateIncident(999, { title: 'Test' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteIncident', () => {
    it('should delete incident', async () => {
      mockReturning.mockResolvedValue([{ id: 1 }]);

      const result = await service.deleteIncident(1);

      expect(result).toEqual({ success: true });
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should throw NotFoundException if incident not found', async () => {
      mockReturning.mockResolvedValue([]);

      await expect(service.deleteIncident(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('postUpdate', () => {
    it('should create update and update incident status', async () => {
      const dto = {
        incidentId: 1,
        status: 'identified',
        message: 'We have identified the issue',
      };

      const mockStatusUpdate = {
        id: 1,
        ...dto,
        createdAt: new Date(),
      };

      mockReturning.mockResolvedValueOnce([mockStatusUpdate]);
      mockReturning.mockResolvedValueOnce([{}]); // For incident update

      const result = await service.postUpdate(dto);

      expect(result).toEqual(mockStatusUpdate);
      expect(mockInsert).toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('statuspage.update.posted', mockStatusUpdate);
    });
  });

  describe('findUpdatesByIncident', () => {
    it('should return all updates for an incident', async () => {
      const mockUpdates = [
        { id: 1, message: 'Investigating', createdAt: new Date() },
        { id: 2, message: 'Fix applied', createdAt: new Date() },
      ];

      mockDb.query.statusPageUpdates.findMany.mockResolvedValue(mockUpdates);

      const result = await service.findUpdatesByIncident(1);

      expect(result).toEqual(mockUpdates);
      expect(result).toHaveLength(2);
    });
  });

  describe('resolveIncident', () => {
    it('should post resolved update and update incident', async () => {
      const message = 'Issue has been resolved';

      // Mock for postUpdate
      mockReturning.mockResolvedValueOnce([
        {
          id: 1,
          incidentId: 1,
          status: 'resolved',
          message,
        },
      ]);
      // Mock for incident update in postUpdate
      mockReturning.mockResolvedValueOnce([{}]);
      // Mock for updateIncident
      mockReturning.mockResolvedValueOnce([
        {
          id: 1,
          status: 'resolved',
          resolvedAt: expect.any(Date),
        },
      ]);
      // Mock for findIncidentById in updateIncident
      mockDb.query.statusPageIncidents.findFirst.mockResolvedValue({
        id: 1,
        status: 'resolved',
        updates: [],
      });

      await service.resolveIncident(1, message);

      // Should call insert for update creation
      expect(mockInsert).toHaveBeenCalled();
      // Should call update twice: once for postUpdate, once for updateIncident
      expect(mockUpdate).toHaveBeenCalled();
    });
  });
});
