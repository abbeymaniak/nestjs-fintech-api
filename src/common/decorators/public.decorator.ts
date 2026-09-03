import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key used to flag routes as public.
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * @Public() Route Decorator
 *
 * WHAT IT DOES:
 * Marks an individual endpoint or an entire controller as publicly accessible,
 * bypassing the global JWT authentication guard.
 *
 * WHY WE USE IT (Interview Talking Point — "Default Deny" Security Architecture):
 * In high-security systems like fintech APIs, the most secure pattern is
 * "DENY BY DEFAULT":
 *
 * Rather than remembering to decorate 30 different controllers with `@UseGuards(JwtAuthGuard)`,
 * which is prone to human error (a developer forgets one decorator and accidentally exposes a
 * sensitive route), we configure `JwtAuthGuard` as a GLOBAL GUARD.
 *
 * This means every route in the entire application requires a valid JWT Bearer token by default.
 * Only routes explicitly decorated with `@Public()` (such as `/auth/register` and `/auth/login`)
 * are allowed through without authentication.
 *
 * HOW IT WORKS INTERNALLY:
 * 1. `@Public()` attaches metadata `{ isPublic: true }` to the target method or class using `SetMetadata`.
 * 2. When an incoming request arrives, our global `JwtAuthGuard` uses NestJS's `Reflector` service
 *    to read this metadata key.
 * 3. If `isPublic` is `true`, the guard immediately returns `true` without checking for a JWT token.
 *
 * USAGE EXAMPLE:
 *   @Public()
 *   @Post('login')
 *   login(@Body() loginDto: LoginDto) { ... }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
