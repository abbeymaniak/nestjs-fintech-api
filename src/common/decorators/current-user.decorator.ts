import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../../users/entities/user.entity';

/**
 * @CurrentUser() Parameter Decorator
 *
 * WHAT IT DOES:
 * Extracts the authenticated User entity from the incoming HTTP request.
 *
 * WHY WE USE IT (Interview Talking Point):
 * In NestJS, when a route is protected by Passport's JwtAuthGuard, Passport validates
 * the JWT bearer token and automatically attaches the decoded user payload or entity
 * to Express's `request.user` object.
 *
 * Instead of injecting the entire low-level `@Req() req` object into our controllers
 * and manually typing `req.user`, this custom parameter decorator:
 * 1. Encapsulates request payload extraction.
 * 2. Provides strong TypeScript typing (`User` or specific fields).
 * 3. Keeps controllers decoupled from the underlying platform (Express / Fastify).
 * 4. Makes unit testing controllers straightforward (easy to mock parameter values).
 *
 * USAGE EXAMPLES:
 * - Get full user entity:
 *     @Get('profile')
 *     getProfile(@CurrentUser() user: User) { return user; }
 *
 * - Get a single property (e.g., user id):
 *     @Post('transfer')
 *     sendTransfer(@CurrentUser('id') userId: string) { ... }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext): User | any => {
    // 1. Switch to HTTP context and extract the Express request object
    const request = ctx.switchToHttp().getRequest();

    // 2. Retrieve the user object attached by Passport's JwtStrategy
    const user = request.user;

    // 3. If a specific property is requested (e.g. @CurrentUser('id')), return just that
    if (data && user) {
      return user[data];
    }

    // 4. Otherwise, return the entire user object
    return user;
  },
);
