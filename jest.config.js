module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/?(*.)+(spec|test).ts'],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  moduleNameMapper: {
    '^isomorphic-core$': '<rootDir>/../isomorphic-core/src/index',
    '^isomorphic-registry$': '<rootDir>/../isomorphic-registry/src/index',
    '^isomorphic-auth$': '<rootDir>/../isomorphic-auth/src/index',
    '^isomorphic-mesh$': '<rootDir>/../isomorphic-mesh/src/index',
    '^raft-consensus$': '<rootDir>/../raft-consensus/src/index'
  }
};
