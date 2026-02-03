import { Test, TestingModule } from '@nestjs/testing';
import { IncidentsController } from '../../src/modules/incidents/incidents.controller';
import { IncidentsService } from '../../src/modules/incidents/incidents.service';
import { IncidentStatusFilter } from '../../src/modules/incidents/dto/list-incidents.dto';

describe('IncidentsController', () => {
  let controller: IncidentsController;
  let service: IncidentsService;

  const mockIncidentsService = {
    list: jest.fn(),
    findById: jest.fn(),
    acknowledge: jest.fn(),
    resolve: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [IncidentsController],
      providers: [
        {
          provide: IncidentsService,
          useValue: mockIncidentsService,
        },
      ],
    }).compile();

    controller = module.get<IncidentsController>(IncidentsController);
    service = module.get<IncidentsService>(IncidentsService);
  });

  describe('list', () => {
    it('should return a list of incidents with default pagination', async () => {
      const mockIncidents = {
        incidents: [
          { id: 1, title: 'Test Incident 1', status: 'triggered' },
          { id: 2, title: 'Test Incident 2', status: 'acknowledged' },
        ],
        total: 2,
        limit: 50,
        offset: 0,
      };

      mockIncidentsService.list.mockResolvedValue(mockIncidents);

      const result = await controller.list({});

      expect(result).toEqual(mockIncidents);
      expect(service.list).toHaveBeenCalledWith({
        status: undefined,
        serviceId: undefined,
        limit: 50,
        offset: 0,
      });
    });

    it('should filter incidents by status', async () => {
      const mockIncidents = {
        incidents: [{ id: 1, title: 'Test Incident', status: 'triggered' }],
        total: 1,
        limit: 50,
        offset: 0,
      };

      mockIncidentsService.list.mockResolvedValue(mockIncidents);

      await controller.list({ status: IncidentStatusFilter.TRIGGERED });

      expect(service.list).toHaveBeenCalledWith({
        status: IncidentStatusFilter.TRIGGERED,
        serviceId: undefined,
        limit: 50,
        offset: 0,
      });
    });

    it('should filter incidents by serviceId', async () => {
      mockIncidentsService.list.mockResolvedValue({
        incidents: [],
        total: 0,
        limit: 50,
        offset: 0,
      });

      await controller.list({ serviceId: 5 });

      expect(service.list).toHaveBeenCalledWith({
        status: undefined,
        serviceId: 5,
        limit: 50,
        offset: 0,
      });
    });

    it('should apply custom limit and offset', async () => {
      mockIncidentsService.list.mockResolvedValue({
        incidents: [],
        total: 0,
        limit: 10,
        offset: 20,
      });

      await controller.list({ limit: 10, offset: 20 });

      expect(service.list).toHaveBeenCalledWith({
        status: undefined,
        serviceId: undefined,
        limit: 10,
        offset: 20,
      });
    });
  });

  describe('findById', () => {
    it('should return an incident by ID', async () => {
      const mockIncident = {
        id: 1,
        title: 'Database Connection Failed',
        status: 'triggered',
        severity: 'critical',
        serviceId: 1,
      };

      mockIncidentsService.findById.mockResolvedValue(mockIncident);

      const result = await controller.findById('1');

      expect(result).toEqual(mockIncident);
      expect(service.findById).toHaveBeenCalledWith(1);
    });

    it('should handle string ID parameter', async () => {
      mockIncidentsService.findById.mockResolvedValue({ id: 123 });

      await controller.findById('123');

      expect(service.findById).toHaveBeenCalledWith(123);
    });
  });

  describe('acknowledge', () => {
    it('should acknowledge an incident', async () => {
      const mockIncident = {
        id: 1,
        status: 'acknowledged',
        acknowledgedAt: new Date(),
        acknowledgedBy: 5,
      };

      mockIncidentsService.acknowledge.mockResolvedValue(mockIncident);

      const user = { id: 5, email: 'user@example.com', name: 'Test User', externalId: 'ext-123', role: 'responder' };
      const result = await controller.acknowledge('1', {}, user);

      expect(result).toEqual(mockIncident);
      expect(service.acknowledge).toHaveBeenCalledWith(1, 5);
    });

    it('should pass correct user ID from current user', async () => {
      mockIncidentsService.acknowledge.mockResolvedValue({ id: 1 });

      const user = { id: 42, email: 'admin@example.com', name: 'Admin', externalId: 'ext-42', role: 'admin' };
      await controller.acknowledge('10', {}, user);

      expect(service.acknowledge).toHaveBeenCalledWith(10, 42);
    });
  });

  describe('resolve', () => {
    it('should resolve an incident', async () => {
      const mockIncident = {
        id: 1,
        status: 'resolved',
        resolvedAt: new Date(),
        resolvedBy: 5,
      };

      mockIncidentsService.resolve.mockResolvedValue(mockIncident);

      const user = { id: 5, email: 'user@example.com', name: 'Test User', externalId: 'ext-123', role: 'responder' };
      const result = await controller.resolve('1', {}, user);

      expect(result).toEqual(mockIncident);
      expect(service.resolve).toHaveBeenCalledWith(1, 5);
    });

    it('should pass correct user ID from current user', async () => {
      mockIncidentsService.resolve.mockResolvedValue({ id: 1 });

      const user = { id: 99, email: 'oncall@example.com', name: 'On-Call User', externalId: 'ext-99', role: 'responder' };
      await controller.resolve('7', {}, user);

      expect(service.resolve).toHaveBeenCalledWith(7, 99);
    });
  });
});
