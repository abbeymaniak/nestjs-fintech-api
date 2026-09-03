import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';
import { User } from '../../users/entities/user.entity';

/**
 * Interface defining the decoded JWT payload structure.
 * According to RFC 7519 JWT specification:
 * - `sub` (Subject): The unique user ID (UUID).
 * - `email`: The user's primary email.
 * - `role`: Assigned user role (USER, ADMIN).
 */
export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

/**
 * JwtStrategy
 *
 * WHAT IT DOES:
 * Intercepts incoming requests, extracts the JWT Bearer token from the
 * `Authorization: Bearer <token>` header, verifies the cryptographic signature,
 * and validates the user in the database.
 *
 * WHY DESIGN DECISIONS WERE MADE (Interview Talking Points):
 * 1. `PassportStrategy(Strategy)` wrapper:
 *    NestJS integrates the industry-standard Passport library through dependency injection.
 *    By extending `PassportStrategy(Strategy)`, this class registers itself as the default
 *    'jwt' authentication strategy in Passport's internal registry.
 *
 * 2. Token Extraction (`ExtractJwt.fromAuthHeaderAsBearerToken()`):
 *    Extracts the token cleanly from the HTTP Authorization header.
 *
 * 3. Database Check in `validate()` (Active User Verification):
 *    Even though a JWT signature is mathematically valid, a user could have been
 *    deactivated, banned, or soft-deleted between the time the token was issued and now.
 *    Calling `this.usersService.findById(payload.sub)` ensures inactive accounts
 *    are immediately rejected with a 401 Unauthorized.
 *
 * 4. Automatic `request.user` Assignment:
 *    Whatever object is returned from this `validate()` method is automatically
 *    attached by Passport to Express's `request.user`, making it accessible via our
 *    `@CurrentUser()` parameter decorator.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is not defined!');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  /**
   * Called automatically by Passport once the JWT token's signature and expiration
   * have been successfully verified.
   */
  async validate(payload: JwtPayload): Promise<User> {
    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account has been deactivated');
    }

    return user;
  }
}
