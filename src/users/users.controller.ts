import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from './entities/user.entity';

/**
 * UsersController
 *
 * WHAT IT DOES:
 * Exposes account and profile operations for authenticated users.
 *
 * WHY DESIGN DECISIONS WERE MADE (Interview Talking Points):
 * 1. IDOR (Insecure Direct Object Reference) Prevention:
 *    A common vulnerability in naive APIs is exposing `GET /users/:id`, where an
 *    attacker simply increments or brute-forces IDs to view other people's accounts.
 *    Instead, our endpoint is `GET /users/profile`, which pulls the identity strictly
 *    from the cryptographically signed JWT token via `@CurrentUser()`.
 *    A user is physically unable to query another user's profile data through this route.
 *
 * 2. Default Deny Security:
 *    This controller is NOT decorated with `@Public()`. Because our application uses
 *    a global `JwtAuthGuard`, any request lacking a valid Bearer token is rejected with 401.
 *
 * 3. Swagger Integration:
 *    Tagged under 'Users' and annotated with `@ApiBearerAuth('JWT-auth')` so Swagger UI
 *    enables the JWT Authorize padlock and documents the response shape.
 */
@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Returns the authenticated user's sanitized profile.
   */
  @Get('profile')
  @ApiOperation({ summary: "Retrieve authenticated user's profile" })
  @ApiResponse({
    status: 200,
    description: 'Profile successfully retrieved',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid token' })
  getProfile(@CurrentUser() user: User) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }
}
