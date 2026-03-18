require('dotenv').config({ path: '.env.test' });

/**
 * Jest Setup File
 * Runs before all tests to configure the test environment
 */

// Suppress console logs during tests but keep error visible
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  // Keep error visible for debugging
  // error: jest.fn(),
};

// Set test environment variables
process.env.NODE_ENV = 'test';

// Mock MongoDB ObjectId validation if needed
global.isValidObjectId = (id) => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};

// Set default timeouts
jest.setTimeout(10000);

// Global afterEach hook to clear all mocks
afterEach(() => {
  jest.clearAllMocks();
});
