import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: !!process.env.SENTRY_DSN,
  // Scrub credentials/PII before events leave the server. The app handles lead
  // data (CNPJ, phones, emails); auth headers and cookies must never reach Sentry.
  beforeSend(event) {
    const headers = event.request?.headers as Record<string, unknown> | undefined;
    if (headers) {
      for (const key of Object.keys(headers)) {
        if (/^(authorization|cookie|x-api-key|apikey)$/i.test(key)) delete headers[key];
      }
    }
    if (event.request && 'cookies' in event.request) delete event.request.cookies;
    return event;
  },
});
