import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Scrub credentials before events leave the browser (Session Replay already
  // masks text by default; this covers error request metadata).
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
