export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transformIgnorePatterns: [
    'node_modules/(?!uuid/)',
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        types: ['node', 'jest'],
      },
    }],
    '^.+\\.js$': ['ts-jest', {
      tsconfig: {
        types: ['node', 'jest'],
        allowJs: true,
      },
    }],
  },
};
