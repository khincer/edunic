module.exports = {
  displayName: 'api',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@edunic/source/db$': '<rootDir>/../../libs/db/src/index.ts',
    '^@edunic/source/db/schema$': '<rootDir>/../../libs/db/src/schema/index.ts',
    '^@edunic/source/domain/events$': '<rootDir>/../../libs/domain/src/events.ts',
    '^@edunic/source/domain/([^/]+)$': '<rootDir>/../../libs/domain/src/$1/index.ts',
    '^@edunic/source/events$': '<rootDir>/../../libs/events/src/index.ts',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
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
  setupFiles: ['<rootDir>/test/setup-env.cjs'],
  setupFilesAfterEnv: ['<rootDir>/test/setup-after-env.cjs'],
  maxWorkers: 1,
};
