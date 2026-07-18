import 'dotenv/config';
import * as Sentry from '@sentry/nestjs';

// ponytail: ConfigModule.forRoot() also loads .env, but only once Nest
// bootstraps — too late for this file, which must init Sentry before
// anything else is imported. dotenv/config here makes SENTRY_DSN readable
// this early. Unset SENTRY_DSN in dev keeps this a no-op; point it at a
// sentry.io DSN or a self-hosted GlitchTip DSN (same wire protocol) to
// enable, no code branching needed between the two.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
  });
}
