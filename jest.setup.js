// Los matchers de @testing-library/jest-native vienen incorporados en
// @testing-library/react-native v12.4+, por eso ya no se importan aparte.

// Mock react-native modules that don't work in jest environment
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  dismissNotificationAsync: jest.fn(),
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      upsert: jest.fn(),
      eq: jest.fn(),
      gte: jest.fn(),
      lt: jest.fn(),
      order: jest.fn(),
      limit: jest.fn(),
      single: jest.fn(),
    })),
  })),
}));

// Mock global fetch if needed
global.fetch = jest.fn();

// Suppress console warnings during tests (optional)
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('RCTBridge required dispatch_sync') ||
        args[0].includes('ViewPropTypes will be removed'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
