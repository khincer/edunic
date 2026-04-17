type ApiApp = {
  get(path: string, handler: () => unknown | Promise<unknown>): void;
};

export async function healthRoutes(app: ApiApp) {
  app.get('/', async () => {
    return { status: 'ok' };
  });
}
