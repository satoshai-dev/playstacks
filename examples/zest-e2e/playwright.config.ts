import { defineConfig } from '@playwright/test';
import { config } from 'dotenv';

// Load .env from this example's directory
config({ path: new URL('.env', import.meta.url).pathname });

export default defineConfig({
  testDir: './tests',
  timeout: 300_000, // 5 min — enough for broadcast + on-chain confirmation
  use: {
    headless: false,
    viewport: { width: 1440, height: 900 },
    // Ensure storage/cookies work — needed for wallet connection state
    storageState: undefined,
    permissions: [],
    javaScriptEnabled: true,
  },
});
