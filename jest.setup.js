// Mock global objects
import { TextEncoder, TextDecoder } from 'util';

// Polyfill for TextEncoder/TextDecoder in Node.js
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
}

if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder;
}

// Mock fetch
global.fetch = jest.fn();

// Mock Next.js router
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRouter = {
  push: mockPush,
  replace: mockReplace,
  pathname: '/',
  route: '/',
  query: {},
  asPath: '/',
};

jest.mock('next/router', () => ({
  useRouter: () => mockRouter,
  withRouter: (Component) => {
    Component.defaultProps = {
      ...Component.defaultProps,
      router: mockRouter,
    };
    return Component;
  },
}));

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:27017/gamehub-test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.NEXTAUTH_SECRET = 'test-nextauth-secret';
process.env.NEXTAUTH_URL = 'http://localhost:3000';

// Mock console methods in test environment
const originalConsole = { ...console };

global.console = {
  ...originalConsole,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(() => {}), // No-op for errors to avoid polluting test output
  debug: jest.fn(),
};

// Clean up mocks after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  mockPush.mockClear();
  mockReplace.mockClear();
});

// Close any open handles after all tests
afterAll(async () => {
  // Close any database connections
  const { mongoose } = await import('mongoose');
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }
});
