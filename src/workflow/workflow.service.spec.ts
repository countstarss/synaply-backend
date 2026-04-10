import { BadRequestException } from '@nestjs/common';
import { WorkflowService } from './workflow.service';

jest.mock(
  'src/prisma/prisma.service',
  () => ({
    PrismaService: class PrismaService {},
  }),
  { virtual: true },
);

const buildService = () => {
  const prisma = {
    workflow: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    issue: {
      findMany: jest.fn(),
    },
  };

  const permissionService = {
    validateResourcePermission: jest.fn().mockResolvedValue(undefined),
  };

  const service = new WorkflowService(
    prisma as any,
    {} as any,
    permissionService as any,
  );

  return { permissionService, prisma, service };
};

describe('WorkflowService', () => {
  it('stores description in workflow json instead of sending it as a Prisma scalar', async () => {
    const { prisma, service } = buildService();
    const existingJson = {
      name: 'Old workflow',
      description: 'Old description',
      nodes: [],
      edges: [],
    };

    prisma.workflow.findUnique.mockResolvedValue({
      id: 'workflow-1',
      name: 'Old workflow',
      version: 'v1',
      json: existingJson,
    });
    prisma.workflow.update.mockImplementation(async (args) => ({
      id: 'workflow-1',
      name: args.data.name,
      version: args.data.version,
      json: args.data.json,
    }));
    prisma.issue.findMany.mockResolvedValue([]);

    await service.update(
      'workflow-1',
      {
        name: 'New workflow',
        description: 'New description',
      },
      'user-1',
    );

    const updateArgs = prisma.workflow.update.mock.calls[0][0];
    expect(updateArgs.data).not.toHaveProperty('description');
    expect(updateArgs.data).toMatchObject({
      name: 'New workflow',
      version: 'v2',
    });
    expect(updateArgs.data.json).toMatchObject({
      name: 'New workflow',
      description: 'New description',
      nodes: [],
      edges: [],
    });
  });

  it('rejects invalid workflow json before updating Prisma', async () => {
    const { prisma, service } = buildService();

    prisma.workflow.findUnique.mockResolvedValue({
      id: 'workflow-1',
      name: 'Workflow',
      version: 'v1',
      json: {},
    });

    await expect(
      service.update('workflow-1', { json: '{' }, 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.workflow.update).not.toHaveBeenCalled();
  });
});
