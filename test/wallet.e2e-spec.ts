import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('Wallet (e2e)', () => {
  let app: INestApplication;
  let userToken: string;
  let userId: string;

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

    const uniqueEmail = `wallet_user_${Date.now()}@fintech.com`;
    const regRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: uniqueEmail,
        password: 'Password123!',
        firstName: 'Wallet',
        lastName: 'Tester',
      })
      .expect(201);

    userToken = regRes.body.tokens.accessToken;
    userId = regRes.body.user.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /users/wallet', () => {
    it('should reject with 401 Unauthorized if no Bearer token is provided', async () => {
      await request(app.getHttpServer()).get('/users/wallet').expect(401);
    });

    it('should retrieve auto-provisioned wallet with 0.0000 balance and NGN currency', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/wallet')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('id');
      expect(res.body.userId).toBe(userId);
      expect(res.body.balance).toBe('0.0000');
      expect(res.body.currency).toBe('NGN');
    });
  });

  describe('POST /wallet/fund', () => {
    it('should reject with 401 Unauthorized if no Bearer token is provided', async () => {
      await request(app.getHttpServer())
        .post('/wallet/fund')
        .send({ amount: 5000 })
        .expect(401);
    });

    it('should reject negative amount with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/wallet/fund')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: -500 })
        .expect(400);

      expect(res.body.message).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Funding amount must be greater than 0'),
        ]),
      );
    });

    it('should reject zero amount with 400 Bad Request', async () => {
      await request(app.getHttpServer())
        .post('/wallet/fund')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 0 })
        .expect(400);
    });

    it('should successfully fund wallet and return updated balance', async () => {
      const res = await request(app.getHttpServer())
        .post('/wallet/fund')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 15000.5, description: 'First deposit' })
        .expect(200);

      expect(res.body.balance).toBe('15000.5000');
      expect(res.body.currency).toBe('NGN');
      expect(res.body).toHaveProperty('transaction');
      expect(res.body.transaction.type).toBe('DEPOSIT');
      expect(res.body.transaction.amount).toBe('15000.5000');
      expect(res.body.transaction.status).toBe('COMPLETED');
      expect(res.body.transaction.description).toBe('First deposit');

      const checkRes = await request(app.getHttpServer())
        .get('/users/wallet')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(checkRes.body.balance).toBe('15000.5000');
    });

    it('should accumulate subsequent deposits correctly', async () => {
      const res = await request(app.getHttpServer())
        .post('/wallet/fund')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 5000 })
        .expect(200);

      expect(res.body.balance).toBe('20000.5000');
    });

    it('should reject non-numeric amount with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/wallet/fund')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 'one-million-naira' })
        .expect(400);

      expect(res.body.message).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            'Amount must be a valid number with up to 4 decimal places',
          ),
        ]),
      );
    });
  });
});
