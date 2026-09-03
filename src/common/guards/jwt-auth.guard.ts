import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * JwtAuthGuard
 *
 * WHAT IT DOES:
 * Intercepts incoming HTTP requests to verify that the request includes a valid
 * JWT Bearer token in the Authorization header.
 *
 * WHY EXTEND AuthGuard('jwt')? (Interview Talking Point):
 * NestJS Passport provides pre-built guards for standard strategies. Extending `AuthGuard('jwt')`:
 * 1. Automatically triggers the `JwtStrategy` (which we will configure in AuthModule).
 * 2. Extracts the token from the header, verifies the signature, and attaches the decoded
 *    user payload to `request.user`.
 * 3. Throws a standardized `401 Unauthorized` exception if the token is missing, expired, or invalid.
 *
 * HOW THE PUBLIC ROUTE BYPASS WORKS:
 * 1. Injected `Reflector` service inspects metadata on both:
 *    - The route handler method (`context.getHandler()`)
 *    - The controller class (`context.getClass()`)
 * 2. `reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, ...)` evaluates method-level metadata first,
 *    falling back to class-level metadata if method-level is not set.
 * 3. If `isPublic` is `true`, authentication is skipped and `canActivate` returns `true`.
 * 4. Otherwise, it delegates to Passport's `super.canActivate(context)` for token verification.
 *
 * GUARD EXECUTION ORDER IN NESTJS:
 * Middleware -> [GUARDS (here)] -> Interceptors (pre) -> Pipes -> Controller Handler -> Interceptors (post) -> Exception Filters
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    // 1. Check if route or controller is decorated with @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 2. If @Public() is present, allow access without token verification
    if (isPublic) {
      return true;
    }

    // 3. Otherwise, execute Passport JWT authentication logic
    return super.canActivate(context);
  }
}
