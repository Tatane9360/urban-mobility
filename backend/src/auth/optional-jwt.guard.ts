import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

// Same token reading as JwtAuthGuard, but never rejects: the journey planner
// stays open to guests (F1 guarantees an anonymous search), while an
// authenticated caller is identified so their Mobility Profile preferences can
// be applied. A malformed or expired token is treated as "no user" rather than
// a 401 — the route grants no privilege, so failing the search would only
// break an anonymous-equivalent request.
export interface OptionallyAuthenticatedRequest extends Request {
  userId?: string;
}

@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<OptionallyAuthenticatedRequest>();
    const header = request.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      try {
        request.userId = this.jwtService.verify<{ sub: string }>(
          header.slice('Bearer '.length),
        ).sub;
      } catch {
        // Anonymous, deliberately.
      }
    }
    return true;
  }
}
