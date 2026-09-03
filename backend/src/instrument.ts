import 'dotenv/config';
import * as Sentry from '@sentry/nestjs';

// dotenv/config, not ConfigModule: this file must init Sentry before anything
// else is imported, which is well before Nest bootstraps and loads .env.
// An unset SENTRY_DSN makes it a no-op; a sentry.io or self-hosted GlitchTip
// DSN both work as-is.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
  });
}
