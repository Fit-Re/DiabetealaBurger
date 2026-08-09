// Jest setup for testing

// Mock process.env for tests
process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_ANON_KEY = 'test-key'

// Setup globals
Object.defineProperty(global, 'fetch', {
  value: jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve([]),
      statusText: 'OK',
    })
  ),
})

// Suppress console warnings in tests
const originalConsoleWarn = console.warn
const originalConsoleError = console.error
console.warn = jest.fn((...args) => {
  if (typeof args[0] === 'string' && args[0].includes('NativeEventEmitter')) {
    return
  }
  originalConsoleWarn(...args)
})
console.error = jest.fn((...args) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('NativeEventEmitter') || args[0].includes('Cannot find module'))
  ) {
    return
  }
  originalConsoleError(...args)
})
