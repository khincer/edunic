import {
  BootstrapService,
  BootstrapServiceError,
} from '../../src/modules/bootstrap/application/bootstrap.service.js';

describe('BootstrapService', () => {
  it('maps migration failures to a 500 service error', async () => {
    const service = new BootstrapService();
    const internals = service as unknown as {
      runMigrations: jest.Mock;
      runCommand: jest.Mock;
    };
    internals.runMigrations = jest
      .fn()
      .mockRejectedValue(new Error('migration exploded'));
    internals.runCommand = jest.fn();

    await expect(service.runBootstrap()).rejects.toEqual(
      expect.objectContaining<Partial<BootstrapServiceError>>({
        message: 'Bootstrap failed during migration: migration exploded',
        statusCode: 500,
      })
    );

    expect(internals.runCommand).not.toHaveBeenCalled();
  });

  it('maps seed failures to a 500 service error', async () => {
    const service = new BootstrapService();
    const internals = service as unknown as {
      runMigrations: jest.Mock;
      runCommand: jest.Mock;
    };
    internals.runMigrations = jest.fn().mockResolvedValue(undefined);
    internals.runCommand = jest.fn().mockImplementation(() => {
        throw new Error('seed exploded');
      });

    await expect(service.runBootstrap()).rejects.toEqual(
      expect.objectContaining<Partial<BootstrapServiceError>>({
        message: 'Bootstrap failed during seed: seed exploded',
        statusCode: 500,
      })
    );

    expect(internals.runMigrations).toHaveBeenCalledTimes(1);
  });
});
