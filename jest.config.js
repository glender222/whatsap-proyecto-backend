// jest.config.js
module.exports = {
  // Entorno de ejecución
  testEnvironment: 'node',

  // Archivos de setup
  // setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.js'],

  // Patrón de archivos de test
  testMatch: [
    '**/tests/**/*.test.js',
    '**/test/**/*.test.js',
    '**/__tests__/**/*.js'
  ],

  // Archivos a ignorar
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/.wwebjs_auth/',
    '/uploads/',
    '/profile-data/'
  ],

  // Cobertura de código
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/app.js',
    '!src/test/**',
    '!src/config/**',
    '!**/node_modules/**'
  ],

  // Directorio de reportes de cobertura
  coverageDirectory: 'coverage',

  // Umbrales de cobertura
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 80,
      statements: 80
    }
  },

  // Transformadores (comentado porque no tenemos babel configurado)
  // transform: {
  //   '^.+\\.js$': 'babel-jest'
  // },

  // Módulos a mockear automáticamente
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },

  // Reportes de cobertura
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary'
  ],

  // Verbose output
  verbose: true,

  // Detectar tests abiertos
  detectOpenHandles: true,

  // Forzar salida después de tests
  forceExit: true,

  // Timeouts globales
  testTimeout: 10000
};