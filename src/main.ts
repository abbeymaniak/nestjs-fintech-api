import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

/**
 * Bootstrap Application Entry Point
 *
 * WHY DESIGN DECISIONS WERE MADE (Interview Talking Points):
 *
 * 1. Global ValidationPipe (Mass Assignment Protection):
 *    - `whitelist: true`: Automatically strips away any properties that do NOT
 *      have decorators in the target DTO. If an attacker submits `{ email, password, role: 'admin' }`,
 *      the unauthorized `role` property is stripped before reaching controller code.
 *    - `forbidNonWhitelisted: true`: Rather than silently discarding unexpected fields,
 *      it immediately throws a 400 Bad Request error.
 *    - `transform: true`: Automatically converts request payloads into typed instances of their DTO classes.
 *
 * 2. Global HttpExceptionFilter:
 *    - Catches all HTTP exceptions thrown throughout the application, formatting them
 *      into our standard JSON response contract.
 *
 * 3. CORS Configuration:
 *    - Enables Cross-Origin Resource Sharing so frontend applications (React, Next.js, mobile web)
 *      can communicate with this API securely.
 *
 * 4. Swagger / OpenAPI 3.0 Documentation:
 *    - Mounted at `/api/docs`.
 *    - Configures Bearer Authentication (`JWT-auth`) for interactive endpoint testing.
 */
async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // 1. Enable CORS for frontend integration
  app.enableCors();

  // 2. Global Input Validation and Sanitization Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // 3. Global Exception Filter for Uniform Error Envelopes
  app.useGlobalFilters(new HttpExceptionFilter());

  // 4. Swagger (OpenAPI 3.0) Specification Setup
  const swaggerConfig = new DocumentBuilder()
    .setTitle('NestJS Fintech API')
    .setDescription(
      'Production-grade fintech API featuring user authentication, wallet operations, atomic fund transfers with double-spending protection, and transaction auditing.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter your JWT access token (format: Bearer <token>)',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Authentication', 'User registration, login, token refresh, and logout')
    .addTag('Users', 'Profile and account management')
    .addTag('Wallet', 'Balance checking and wallet funding')
    .addTag('Transfers', 'Peer-to-peer transfers and withdrawals')
    .addTag('Transactions', 'Audited transaction history with date and type filters')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`Interactive Swagger UI docs available at: http://localhost:${port}/api/docs`);
}

bootstrap();
