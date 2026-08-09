// Jest setup for React Native testing
jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter')

// Mock useColorScheme
jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  useColorScheme: jest.fn(() => 'light'),
}))
