import { logger } from '../lib/logger'

describe('Logger', () => {
  // Save original console methods
  const originalConsole = { ...console }
  const mockConsole = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  }

  beforeAll(() => {
    // Mock console methods
    global.console = mockConsole as any
  })

  afterEach(() => {
    // Clear logs and mocks after each test
    logger.clearLogs()
    jest.clearAllMocks()
  })

  afterAll(() => {
    // Restore original console
    global.console = originalConsole
  })

  describe('Log levels', () => {
    it('should log error messages', () => {
      const error = new Error('Test error')
      logger.error('Test error message', { key: 'value' }, error)
      
      expect(console.error).toHaveBeenCalled()
      const logs = logger.getLogs()
      expect(logs.length).toBe(1)
      expect(logs[0].level).toBe('error')
      expect(logs[0].message).toBe('Test error message')
      expect(logs[0].context).toEqual({ key: 'value' })
      expect(logs[0].error).toBe(error)
    })

    it('should log warning messages', () => {
      logger.warn('Test warning', { warning: true })
      
      expect(console.warn).toHaveBeenCalled()
      const logs = logger.getLogs('warn')
      expect(logs.length).toBe(1)
      expect(logs[0].level).toBe('warn')
      expect(logs[0].message).toBe('Test warning')
      expect(logs[0].context).toEqual({ warning: true })
    })

    it('should log info messages', () => {
      logger.info('Test info', { info: true })
      
      expect(console.info).toHaveBeenCalled()
      const logs = logger.getLogs('info')
      expect(logs.length).toBe(1)
      expect(logs[0].level).toBe('info')
    })

    it('should log debug messages', () => {
      logger.debug('Test debug', { debug: true })
      
      expect(console.debug).toHaveBeenCalled()
      const logs = logger.getLogs('debug')
      expect(logs.length).toBe(1)
      expect(logs[0].level).toBe('debug')
    })
  })

  describe('Log management', () => {
    it('should limit the number of logs in memory', () => {
      // Set max logs to 5 for testing
      const originalMaxLogs = (logger as any).maxLogs;
      (logger as any).maxLogs = 5;
      
      // Add more logs than the limit
      for (let i = 0; i < 10; i++) {
        logger.info(`Test log ${i}`)
      }
      
      // Should only keep the most recent logs
      const logs = logger.getLogs()
      expect(logs.length).toBe(5)
      expect(logs[0].message).toBe('Test log 5') // Oldest kept log
      expect(logs[4].message).toBe('Test log 9') // Newest log
      
      // Restore original max logs
      (logger as any).maxLogs = originalMaxLogs;
    })

    it('should filter logs by level', () => {
      logger.error('Error message')
      logger.warn('Warning message')
      logger.info('Info message')
      logger.debug('Debug message')
      
      expect(logger.getLogs('error').length).toBe(1)
      expect(logger.getLogs('warn').length).toBe(1)
      expect(logger.getLogs('info').length).toBe(1)
      expect(logger.getLogs('debug').length).toBe(1)
      expect(logger.getLogs().length).toBe(4)
    })

    it('should clear all logs', () => {
      logger.info('Test log')
      logger.clearLogs()
      expect(logger.getLogs().length).toBe(0)
    })
  })

  describe('Error handling', () => {
    it('should handle circular references in context', () => {
      const circularObj: any = { key: 'value' }
      circularObj.self = circularObj
      
      expect(() => {
        logger.info('Test circular reference', circularObj)
      }).not.toThrow()
      
      expect(console.info).toHaveBeenCalled()
    })
  })
})
