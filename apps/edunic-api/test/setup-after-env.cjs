afterAll(async () => {
  if (!process.env.DATABASE_URL) {
    return;
  }

  const helper = await import('./helpers/db.js');
  await helper.closeTestDatabase();
});
