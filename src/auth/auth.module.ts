import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * AuthModule
 *
 * WHAT IT DOES:
 * Bundles and wires all components related to user authentication and token handling.
 *
 * WHY DESIGN DECISIONS WERE MADE (Interview Talking Points):
 * 1. Async JWT Registration (`JwtModule.registerAsync`):
 *    In production, cryptographic secrets must NOT be hardcoded.
 *    Using `registerAsync` with `inject: [ConfigService]` ensures environment variables
 *    from `.env` (`JWT_SECRET`, `JWT_EXPIRES`) are fully loaded and validated before
 *    the JWT signing engine initializes.
 *
 * 2. Passport Default Strategy:
 *    `PassportModule.register({ defaultStrategy: 'jwt' })` registers JWT as the
 *    default fallback authentication mechanism across the entire module.
 *
 * 3. Module Encapsulation:
 *    Imports `UsersModule` to leverage `UsersService` queries while keeping domain logic separated.
 *    Exports `PassportModule` and `JwtModule` so other modules can utilize auth guards if needed.
 */
@Module({
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (configService.get<string>('JWT_EXPIRES') || '15m') as any,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, PassportModule, JwtModule],
})
export class AuthModule {}
