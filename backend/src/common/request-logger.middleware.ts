import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

// One line per request: what was called, how it ended, how long it took, and
// who by. A middleware rather than per-service instrumentation so a route
// added later is traced without anyone remembering to annotate it.
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(request: Request, response: Response, next: NextFunction): void {
    const startedAt = process.hrtime.bigint();

    // 'finish' fires after the response is sent, which is the only point where
    // both the status code and JwtAuthGuard's request.userId exist —
    // middleware itself runs before guards, so reading userId here would
    // always find it undefined.
    response.once('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      // The UUID identifies the account and disappears with it; the email
      // would put personal data in the host's log store, outside the erasure
      // path /auth/me implements. `path` deliberately drops the query string:
      // /geocode?q=... carries the address someone searched for.
      const userId = (request as { userId?: string }).userId;
      const who = userId ? `user=${userId}` : 'anon';
      const line = `${request.method} ${request.path} ${response.statusCode} ${durationMs.toFixed(0)}ms ${who}`;

      // 5xx is already going to Sentry with its stack; logging it as an error
      // here too would mean reading two places for one incident.
      if (response.statusCode >= 500) this.logger.warn(line);
      else this.logger.log(line);
    });

    next();
  }
}
