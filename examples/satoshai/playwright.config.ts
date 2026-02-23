import { defineConfig } from '@playwright/test';
import { config } from 'dotenv';

// Load .env from this example's directory
config({ path: new URL('.env', import.meta.url).pathname });

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  use: {
    headless: false,
  },
});
