import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env') });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

export default defineConfig({
  schema: resolve(__dirname, './schema.prisma'),
  migrations: {
    path: resolve(__dirname, './migrations'),
  },
  datasource: {
    url: databaseUrl,
  },
});
