import { defineConfig } from '@playwright/test';
import { config } from 'dotenv';

// Load .env from this example's directory
config({ path: new URL('.env', import.meta.url).pathname });

export default defineConfig({
  testDir: './tests',
  timeout: 300_000, // 5 min — enough for broadcast + on-chain confirmation
  workers: 1, // sequential — tests share the same wallet (nonce conflicts otherwise)
  use: {
    headless: false,
    viewport: { width: 1440, height: 900 },
  },
});
