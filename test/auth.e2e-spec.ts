import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('Auth & Users Lifecycle (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const testUser = {
    email: 'e2e.tester@fintech.com',
    password: 'P@ssword123!',
    firstName: 'E2E',
    lastName: 'Tester',
    phoneNumber: '+1-555-0100',
  };

  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
    await dataSource.query('TRUNCATE TABLE "users" CASCADE;');
  });

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      await dataSource.query('TRUNCATE TABLE "users" CASCADE;');
    }
    await app.close();
  });

  describe('1. Registration Flow (POST /auth/register)', () => {
    it('should reject registration if password does not meet complexity requirements (400)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: testUser.email,
          password: 'weak',
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
      expect(response.body).toHaveProperty('error', 'Bad Request');
      expect(Array.isArray(response.body.message)).toBe(true);
    });

    it('should reject registration if email is invalid (400)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'not-a-valid-email',
          password: testUser.password,
        })
        .expect(400);

      expect(response.body.message).toContain(
        'Please provide a valid email address',
      );
    });

    it('should successfully register a valid user and return tokens (201)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user.role).toBe('user');
      expect(response.body.user.isActive).toBe(true);
      expect(response.body.user.password).toBeUndefined();
      expect(response.body.user.refreshToken).toBeUndefined();

      expect(response.body).toHaveProperty('tokens');
      expect(response.body.tokens).toHaveProperty('accessToken');
      expect(response.body.tokens).toHaveProperty('refreshToken');

      accessToken = response.body.tokens.accessToken;
      refreshToken = response.body.tokens.refreshToken;
    });

    it('should reject duplicate email registration with 409 Conflict', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(409);

      expect(response.body.message).toBe(
        'A user with this email already exists',
      );
    });
  });

  describe('2. Login Flow (POST /auth/login)', () => {
    it('should reject login with wrong password (401)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword!',
        })
        .expect(401);

      expect(response.body.message).toBe('Invalid email or password');
    });

    it('should reject login with non-existent email (401)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonexistent@fintech.com',
          password: testUser.password,
        })
        .expect(401);

      expect(response.body.message).toBe('Invalid email or password');
    });

    it('should successfully login with valid credentials (200)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(response.body).toHaveProperty('tokens');
      expect(response.body.tokens.accessToken).toBeDefined();

      accessToken = response.body.tokens.accessToken;
      refreshToken = response.body.tokens.refreshToken;
    });
  });

  describe('3. Protected Profile Flow (GET /users/profile)', () => {
    it('should reject unauthenticated request without token (401)', async () => {
      await request(app.getHttpServer()).get('/users/profile').expect(401);
    });

    it('should reject request with forged/malformed token (401)', async () => {
      await request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', 'Bearer invalid-token-string-xyz')
        .expect(401);
    });

    it('should successfully return authenticated user profile with valid Bearer token (200)', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.email).toBe(testUser.email);
      expect(response.body.firstName).toBe(testUser.firstName);
      expect(response.body.lastName).toBe(testUser.lastName);
      expect(response.body.phoneNumber).toBe(testUser.phoneNumber);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body.password).toBeUndefined();
    });
  });

  describe('4. Token Refresh Flow (POST /auth/refresh)', () => {
    it('should successfully rotate tokens when valid refresh token is supplied (200)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');

      accessToken = response.body.accessToken;
      refreshToken = response.body.refreshToken;
    });

    it('should reject refresh with invalid or forged token (401)', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'fake-refresh-token' })
        .expect(401);
    });
  });

  describe('5. Logout Flow (POST /auth/logout)', () => {
    it('should successfully revoke session with valid token (200)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.message).toBe('Logged out successfully');
    });

    it('should reject subsequent refresh attempts using the old revoked refresh token (401)', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });
  });
});
