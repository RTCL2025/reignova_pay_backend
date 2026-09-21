import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: 'postgres://postgres:postgres@localhost:5435/payment_service_test',
      DB_NAME: 'payment_service_test',
      DB_SSL: 'false',
      NODE_ENV: 'test'
    },
    globals: true,
    environment: 'node',
    testTimeout: 20000,
    hookTimeout: 20000,
    fileParallelism: false,
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'tests/']
    }
  }
});
