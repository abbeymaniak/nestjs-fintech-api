import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService, AuthResponse, AuthTokens } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

/**
 * AuthController
 *
 * WHAT IT DOES:
 * Exposes REST endpoints for user authentication:
 * - Registration (`POST /auth/register`)
 * - Login (`POST /auth/login`)
 * - Token Refresh (`POST /auth/refresh`)
 * - Logout (`POST /auth/logout`)
 *
 * WHY DESIGN DECISIONS WERE MADE (Interview Talking Points):
 * 1. Explicit HTTP Status Codes (@HttpCode):
 *    In NestJS, POST routes return 201 Created by default.
 *    For actions like `login`, `refresh`, and `logout`, no new resource is created.
 *    We explicitly apply `@HttpCode(HttpStatus.OK)` (200) to adhere to strict REST semantics.
 *
 * 2. Swagger Documentation (@ApiTags, @ApiOperation, @ApiResponse):
 *    Fully documented for OpenAPI 3.0, allowing frontend engineers to test payloads
 *    interactively via Swagger UI at `/api/docs`.
 *
 * 3. Default-Deny Exemption (@Public):
 *    Since our application uses a global JWT guard, `register`, `login`, and `refresh`
 *    are decorated with `@Public()` to permit unauthenticated traffic.
 *    `logout` is NOT marked `@Public()`, requiring a valid JWT Bearer token.
 */
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Register a new user account.
   */
  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiResponse({
    status: 201,
    description: 'User successfully registered; returns profile and JWT tokens',
  })
  @ApiResponse({ status: 400, description: 'Invalid input or weak password' })
  @ApiResponse({ status: 409, description: 'Email address already registered' })
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponse> {
    return await this.authService.register(registerDto);
  }

  /**
   * Authenticate with email & password to obtain tokens.
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user and obtain JWT token pair' })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful; returns token pair',
  })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponse> {
    return await this.authService.login(loginDto);
  }

  /**
   * Exchange an active refresh token for a fresh token pair.
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token and get a new access token' })
  @ApiResponse({
    status: 200,
    description: 'Tokens rotated successfully; returns fresh token pair',
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto,
  ): Promise<AuthTokens> {
    return await this.authService.refreshToken(refreshTokenDto);
  }

  /**
   * Invalidate the current session and revoke the stored refresh token.
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Revoke active refresh token session' })
  @ApiResponse({ status: 200, description: 'Session successfully revoked' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid token' })
  async logout(@CurrentUser('id') userId: string): Promise<{ message: string }> {
    return await this.authService.logout(userId);
  }
}
