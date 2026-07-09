import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard, AuthenticatedRequest } from './jwt.guard';

function contextWithHeader(header?: string): ExecutionContext {
  const request = {
    headers: { authorization: header },
  } as AuthenticatedRequest;
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  const jwtService = new JwtService({ secret: 'test-secret' });
  const guard = new JwtAuthGuard(jwtService);

  it('allows a request with a valid bearer token and attaches userId', () => {
    const token = jwtService.sign({ sub: 'user-123' });
    const context = contextWithHeader(`Bearer ${token}`);

    expect(guard.canActivate(context)).toBe(true);
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    expect(request.userId).toBe('user-123');
  });

  it('rejects a request with no authorization header', () => {
    expect(() => guard.canActivate(contextWithHeader(undefined))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a request with an invalid token', () => {
    expect(() =>
      guard.canActivate(contextWithHeader('Bearer not-a-real-token')),
    ).toThrow(UnauthorizedException);
  });
});
