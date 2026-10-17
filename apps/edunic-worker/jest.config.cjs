module.exports = {
  displayName: 'worker',
  testEnvironment: 'node',
  // Same layout as the api jest config: rootDir is the repo root so shared
  // libs (libs/events, libs/domain) resolve under one transform pipeline.
  rootDir: '../..',
  roots: ['<rootDir>/apps/edunic-worker'],
  testMatch: ['<rootDir>/apps/edunic-worker/test/**/*.spec.ts'],
  collectCoverageFrom: [
    '<rootDir>/apps/edunic-worker/src/**/*.ts',
    '<rootDir>/libs/events/src/**/*.ts',
    '!**/*.d.ts',
  ],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@edunic/source/db$': '<rootDir>/libs/db/src/index.ts',
    '^@edunic/source/db/schema$': '<rootDir>/libs/db/src/schema/index.ts',
    '^@edunic/source/domain/events$': '<rootDir>/libs/domain/src/events.ts',
    '^@edunic/source/domain/([^/]+)$': '<rootDir>/libs/domain/src/$1/index.ts',
    '^@edunic/source/events$': '<rootDir>/libs/events/src/index.ts',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/apps/edunic-worker/tsconfig.spec.json',
        useESM: false,
      },
    ],
    '^.+\\.js$': [
      'babel-jest',
      {
        presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
        babelrc: false,
        configFile: false,
      },
    ],
  },
  transformIgnorePatterns: ['node_modules/(?!(jose)/)'],
  setupFiles: ['<rootDir>/apps/edunic-worker/test/setup-env.cjs'],
  setupFilesAfterEnv: ['<rootDir>/apps/edunic-worker/test/setup-after-env.cjs'],
  maxWorkers: 1,
};
