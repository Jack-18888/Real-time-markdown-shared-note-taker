import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  globalSetup: '<rootDir>/src/__tests__/global-setup.ts',
  globalTeardown: '<rootDir>/src/__tests__/global-teardown.ts',
  setupFiles: ['<rootDir>/src/__tests__/env-setup.ts'],
};

export default config;
