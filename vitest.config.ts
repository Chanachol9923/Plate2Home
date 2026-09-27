import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const alias = { '@': fileURLToPath(new URL('.', import.meta.url)) };

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          environment: 'node',
          include: [
            'lib/**/*.test.ts',
            'components/**/*.test.{ts,tsx}',
            'scripts/**/*.test.ts',
            'eslint-rules/**/*.test.ts',
            'messages/**/*.test.ts',
          ],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'db',
          environment: 'node',
          include: ['supabase/tests/**/*.test.ts'],
          // Test files share fixture ids; against a real database they must not interleave.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts'],
      exclude: ['**/*.test.ts'],
    },
  },
});
