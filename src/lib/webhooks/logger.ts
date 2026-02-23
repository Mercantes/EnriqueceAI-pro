interface LogContext {
  event_id?: string;
  event_type?: string;
  duration_ms?: number;
  [key: string]: unknown;
}

export interface WebhookLogger {
  info: (message: string, context?: LogContext) => void;
  warn: (message: string, context?: LogContext) => void;
  error: (message: string, context?: LogContext) => void;
}

function formatMessage(provider: string, message: string, context?: LogContext): string {
  const prefix = `[webhook:${provider}]`;
  if (!context || Object.keys(context).length === 0) {
    return `${prefix} ${message}`;
  }
  return `${prefix} ${message} ${JSON.stringify(context)}`;
}

export function createWebhookLogger(provider: string): WebhookLogger {
  return {
    info(message: string, context?: LogContext) {
      console.warn(formatMessage(provider, message, context));
    },
    warn(message: string, context?: LogContext) {
      console.warn(formatMessage(provider, message, context));
    },
    error(message: string, context?: LogContext) {
      console.error(formatMessage(provider, message, context));
    },
  };
}
