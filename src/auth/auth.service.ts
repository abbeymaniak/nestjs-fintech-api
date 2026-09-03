import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtPayload } from './strategies/jwt.strategy';

/**
 * Interface representing the paired tokens returned to the client.
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Interface representing standard auth response payload.
 */
export interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role: UserRole;
    isActive: boolean;
  };
  tokens: AuthTokens;
}

/**
 * AuthService
 *
 * WHAT IT DOES:
 * Coordinates all authentication workflows: user registration, credential validation,
 * password hashing, JWT token generation, and secure refresh token rotation.
 *
 * WHY DESIGN DECISIONS WERE MADE (Interview Talking Points):
 * 1. Dual-Token Architecture (Short-Lived Access + Long-Lived Refresh):
 *    - Access tokens are short-lived (15 minutes), meaning if an attacker intercepts one,
 *      their access window is strictly limited.
 *    - Refresh tokens are long-lived (7 days) and used exclusively to request fresh access tokens.
 *
 * 2. Hashing Refresh Tokens in Database:
 *    Raw refresh tokens are NEVER stored in PostgreSQL. We store a `bcrypt` hash of the
 *    refresh token. If the database is compromised, stolen token hashes cannot be used
 *    to forge or request valid access tokens.
 *
 * 3. Refresh Token Rotation:
 *    Every time a client exchanges a refresh token, BOTH the access token and the refresh token
 *    are regenerated, and the old refresh token hash is overwritten.
 *
 * 4. User Enumeration Protection:
 *    On login failure, we throw a generic `UnauthorizedException('Invalid email or password')`.
 *    We never say "Email not found" or "Wrong password" to prevent attackers from discovering
 *    which emails are registered on the platform.
 *
 * 5. Password Hashing with Bcrypt:
 *    Passwords are salted and hashed using 10 rounds of bcrypt (computationally intensive,
 *    resilient against rainbow-table and GPU brute-force attacks).
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Registers a new user, hashes their password, persists them, and issues tokens.
   */
  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const { email, password, firstName, lastName, phoneNumber } = registerDto;

    // 1. Check if email is already taken
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    // 2. Hash password with bcrypt (10 salt rounds)
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 3. Persist user to database
    const newUser = await this.usersService.create({
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      firstName,
      lastName,
      phoneNumber,
      role: UserRole.USER,
      isActive: true,
    });

    // 4. Generate JWT Access and Refresh token pair
    const tokens = await this.generateTokens(newUser.id, newUser.email, newUser.role);

    // 5. Store hashed refresh token in database for session management
    await this.updateHashedRefreshToken(newUser.id, tokens.refreshToken);

    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role,
        isActive: newUser.isActive,
      },
      tokens,
    };
  }

  /**
   * Authenticates user credentials and issues a fresh token pair.
   */
  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { email, password } = loginDto;

    // 1. Retrieve user including hidden password hash
    const user = await this.usersService.findByEmailWithSecrets(email);

    // 2. Generic error message prevents email enumeration
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // 3. Verify user account status
    if (!user.isActive) {
      throw new UnauthorizedException('Account has been deactivated');
    }

    // 4. Verify password against stored bcrypt hash
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // 5. Generate fresh token pair
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    // 6. Update hashed refresh token in database
    await this.updateHashedRefreshToken(user.id, tokens.refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
      },
      tokens,
    };
  }

  /**
   * Rotates tokens: validates incoming refresh token against the stored hash
   * and issues a brand-new token pair.
   */
  async refreshToken(refreshTokenDto: RefreshTokenDto): Promise<AuthTokens> {
    const { refreshToken } = refreshTokenDto;
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');

    // 1. Verify token signature and expiration
    let decoded: JwtPayload;
    try {
      decoded = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // 2. Fetch user with their stored hashed refresh token
    const user = await this.usersService.findByIdWithRefreshToken(decoded.sub);
    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Access Denied: Session revoked or not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // 3. Compare incoming plain refresh token against stored bcrypt hash
    const isTokenMatching = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!isTokenMatching) {
      throw new UnauthorizedException('Access Denied: Invalid refresh token');
    }

    // 4. Issue a new token pair (TOKEN ROTATION)
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    // 5. Overwrite the stored refresh token hash with the new one
    await this.updateHashedRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  /**
   * Logs out the user by revoking and clearing their stored refresh token hash.
   */
  async logout(userId: string): Promise<{ message: string }> {
    await this.usersService.updateRefreshToken(userId, null);
    return { message: 'Logged out successfully' };
  }

  /**
   * Generates paired Access Token (15m) and Refresh Token (7d).
   */
  private async generateTokens(
    userId: string,
    email: string,
    role: UserRole,
  ): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: userId,
      email,
      role,
    };

    const accessSecret = this.configService.get<string>('JWT_SECRET');
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    const accessExpiresIn = this.configService.get<string>('JWT_EXPIRES') || '15m';
    const refreshExpiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRES') || '7d';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: accessSecret,
        expiresIn: accessExpiresIn as any,
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn as any,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  /**
   * Hashes the refresh token with bcrypt before saving to PostgreSQL.
   */
  private async updateHashedRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const saltRounds = 10;
    const hashedRefreshToken = await bcrypt.hash(refreshToken, saltRounds);
    await this.usersService.updateRefreshToken(userId, hashedRefreshToken);
  }
}
