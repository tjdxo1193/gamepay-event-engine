import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@controllers/(.*)$': '<rootDir>/src/controllers/$1',
    '^@handlers/(.*)$': '<rootDir>/src/handlers/$1',
    '^@workers/(.*)$': '<rootDir>/src/workers/$1',
    '^@models/(.*)$': '<rootDir>/src/models/$1',
    '^@routes/(.*)$': '<rootDir>/src/routes/$1',
    '^@events/(.*)$': '<rootDir>/src/events/$1',
    '^@queues/(.*)$': '<rootDir>/src/queues/$1',
    '^@common/(.*)$': '<rootDir>/src/common/$1',
  },
  setupFiles: ['reflect-metadata'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/index.ts',
    '!src/config/container.ts',
  ],
};

export default config;
