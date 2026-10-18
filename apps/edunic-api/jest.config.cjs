module.exports = {
  displayName: 'api',
  testEnvironment: 'node',
  // rootDir must be the repo root: babel-plugin-istanbul refuses to instrument
  // files outside it (test-exclude drops paths starting with ".."), so a rootDir
  // of apps/edunic-api silently excluded libs/domain from coverage.
  rootDir: '../..',
  roots: ['<rootDir>/apps/edunic-api'],
  testMatch: ['<rootDir>/apps/edunic-api/test/**/*.spec.ts'],
  collectCoverageFrom: [
    '<rootDir>/apps/edunic-api/src/**/*.ts',
    '<rootDir>/libs/domain/src/**/*.ts',
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
        tsconfig: '<rootDir>/apps/edunic-api/tsconfig.spec.json',
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
  setupFiles: ['<rootDir>/apps/edunic-api/test/setup-env.cjs'],
  setupFilesAfterEnv: ['<rootDir>/apps/edunic-api/test/setup-after-env.cjs'],
  maxWorkers: 1,
};
