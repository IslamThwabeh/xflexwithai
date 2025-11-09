/**
 * Centralized logging utility for XFlex Trading Academy
 * 
 * Usage:
 * - Set DEBUG_LOGGING=true in environment to enable detailed logs
 * - Set DEBUG_LOGGING=false or omit to disable (production mode)
 * 
 * Example:
 * logger.info('User logged in', { userId: 123 });
 * logger.error('Database error', { error: err.message });
 */

const isDebugEnabled = process.env.DEBUG_LOGGING === 'true';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  [key: string]: any;
}

class Logger {
  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  private shouldLog(level: LogLevel): boolean {
    // Always log errors and warnings
    if (level === 'error' || level === 'warn') {
      return true;
    }
    // Only log info and debug if DEBUG_LOGGING is enabled
    return isDebugEnabled;
  }

  info(message: string, context?: LogContext) {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, context));
    }
  }

  warn(message: string, context?: LogContext) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, context));
    }
  }

  error(message: string, context?: LogContext) {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, context));
    }
  }

  debug(message: string, context?: LogContext) {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, context));
    }
  }

  // Special method for tracing procedure calls
  procedure(procedureName: string, input?: any, userId?: number) {
    if (isDebugEnabled) {
      this.info(`tRPC Procedure: ${procedureName}`, {
        input,
        userId,
      });
    }
  }

  // Special method for database operations
  db(operation: string, details?: LogContext) {
    if (isDebugEnabled) {
      this.debug(`Database: ${operation}`, details);
    }
  }

  // Special method for authentication events
  auth(event: string, details?: LogContext) {
    this.info(`Auth: ${event}`, details);
  }
}

export const logger = new Logger();

// Log the logging status on startup
if (isDebugEnabled) {
  console.log('[LOGGER] Debug logging is ENABLED (DEBUG_LOGGING=true)');
} else {
  console.log('[LOGGER] Debug logging is DISABLED (set DEBUG_LOGGING=true to enable)');
}
