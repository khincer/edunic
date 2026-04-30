import {
  BootstrapService,
  BootstrapServiceError,
} from '../../src/modules/bootstrap/application/bootstrap.service.js';

describe('BootstrapService', () => {
  it('maps migration failures to a 500 service error', async () => {
    const service = new BootstrapService();
    const commandSpy = jest
      .spyOn(service as never, 'runCommand')
      .mockImplementation(() => {
        throw new Error('migration exploded');
      });

    await expect(service.runBootstrap()).rejects.toEqual(
      expect.objectContaining<Partial<BootstrapServiceError>>({
        message: 'Bootstrap failed during migration: migration exploded',
        statusCode: 500,
      })
    );

    commandSpy.mockRestore();
  });

  it('maps seed failures to a 500 service error', async () => {
    const service = new BootstrapService();
    const commandSpy = jest
      .spyOn(service as never, 'runCommand')
      .mockImplementationOnce(() => undefined)
      .mockImplementationOnce(() => {
        throw new Error('seed exploded');
      });

    await expect(service.runBootstrap()).rejects.toEqual(
      expect.objectContaining<Partial<BootstrapServiceError>>({
        message: 'Bootstrap failed during seed: seed exploded',
        statusCode: 500,
      })
    );

    commandSpy.mockRestore();
  });
});
