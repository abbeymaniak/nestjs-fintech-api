import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import databaseConfig from './config/database.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

/**
 * AppModule
 *
 * WHAT IT DOES:
 * The root module of the application. Orchestrates shared infrastructure, database
 * connections, feature modules, and global security guards.
 *
 * WHY DESIGN DECISIONS WERE MADE (Interview Talking Points):
 * 1. Global Guards via Dependency Injection (`APP_GUARD`):
 *    In NestJS, binding guards using `app.useGlobalGuards(new Guard())` in `main.ts`
 *    prevents the guard from injecting NestJS services (like Reflector or UsersService).
 *    Using `{ provide: APP_GUARD, useClass: ... }` registers guards within the Nest
 *    Inversion of Control (IoC) container, allowing full dependency injection.
 *
 * 2. Guard Execution Order:
 *    Guards execute in the exact order declared in the `providers` array:
 *    - `ThrottlerGuard` runs first: Rejects abusive traffic / DDoS before authentication logic runs.
 *    - `JwtAuthGuard` runs second: Enforces "Deny by Default" JWT protection across all routes.
 *
 * 3. Rate Limiting with Throttler:
 *    Limits requests to 10 per minute per IP address by default, mitigating brute-force
 *    and credential-stuffing attacks.
 */
@Module({
  imports: [
    // 1. Load application configuration globally
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig],
    }),

    // 2. Asynchronous PostgreSQL TypeORM Connection
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.database'),
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),

    // 3. Global Rate Limiting: 10 requests per 60 seconds per IP
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 10,
      },
    ]),

    // 4. Feature Modules
    UsersModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global Guard 1: Rate Limiter
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Global Guard 2: Deny-by-Default JWT Authentication
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
