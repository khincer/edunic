import { db } from "../libs/db/src";
import { students } from "../libs/db/src/schema";

async function seed() {
  console.log('🌱 Seeding database...');

  await db.insert(students).values([
    {
      institutionId: '00000000-0000-0000-0000-000000000001',
      firstName: 'John',
      lastName: 'Doe',
    },
    {
      institutionId: '00000000-0000-0000-0000-000000000001',
      firstName: 'Jane',
      lastName: 'Smith',
    },
  ]);

  console.log('✅ Seed complete');
  process.exit(0);
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
