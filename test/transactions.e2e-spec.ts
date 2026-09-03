import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('Transactions History & Filters (e2e)', () => {
  let app: INestApplication;
  let userAToken: string;
  let userAEmail: string;
  let userBToken: string;
  let userBEmail: string;
  let userATransferOutId: string;
  let userAWithdrawalId: string;

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

    userAEmail = `ledger_user_a_${Date.now()}@fintech.com`;
    const regResA = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: userAEmail,
        password: 'Password123!',
        firstName: 'Ledger',
        lastName: 'UserA',
      })
      .expect(201);

    userAToken = regResA.body.tokens.accessToken;

    userBEmail = `ledger_user_b_${Date.now()}@fintech.com`;
    const regResB = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: userBEmail,
        password: 'Password123!',
        firstName: 'Ledger',
        lastName: 'UserB',
      })
      .expect(201);

    userBToken = regResB.body.tokens.accessToken;

    await request(app.getHttpServer())
      .post('/wallet/fund')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ amount: 2000 })
      .expect(200);

    await request(app.getHttpServer())
      .post('/transfers/send')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        recipientEmail: userBEmail,
        amount: 300,
        description: 'Payment for consultation',
      })
      .expect(200);

    await request(app.getHttpServer())
      .post('/transfers/withdraw')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        amount: 150,
        description: 'Personal withdrawal',
      })
      .expect(200);

    const initialHistoryRes = await request(app.getHttpServer())
      .get('/transactions')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);

    const transferTx = initialHistoryRes.body.data.find(
      (tx: any) => tx.type === 'TRANSFER_OUT',
    );
    const withdrawTx = initialHistoryRes.body.data.find(
      (tx: any) => tx.type === 'WITHDRAWAL',
    );

    userATransferOutId = transferTx.id;
    userAWithdrawalId = withdrawTx.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /transactions', () => {
    it('should reject with 401 Unauthorized if no Bearer token is provided', async () => {
      await request(app.getHttpServer())
        .get('/transactions')
        .expect(401);
    });

    it('should retrieve paginated transactions with metadata for authenticated user', async () => {
      const res = await request(app.getHttpServer())
        .get('/transactions')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      expect(res.body.meta.total).toBeGreaterThanOrEqual(2);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(10);
    });

    it('should filter transactions by type', async () => {
      const transferRes = await request(app.getHttpServer())
        .get('/transactions?type=TRANSFER_OUT')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(transferRes.body.data.length).toBeGreaterThanOrEqual(1);
      for (const tx of transferRes.body.data) {
        expect(tx.type).toBe('TRANSFER_OUT');
      }

      const withdrawRes = await request(app.getHttpServer())
        .get('/transactions?type=WITHDRAWAL')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(withdrawRes.body.data.length).toBeGreaterThanOrEqual(1);
      for (const tx of withdrawRes.body.data) {
        expect(tx.type).toBe('WITHDRAWAL');
      }

      const depositRes = await request(app.getHttpServer())
        .get('/transactions?type=DEPOSIT')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(depositRes.body.data.length).toBeGreaterThanOrEqual(1);
      for (const tx of depositRes.body.data) {
        expect(tx.type).toBe('DEPOSIT');
      }
    });

    it('should filter transactions by status', async () => {
      const res = await request(app.getHttpServer())
        .get('/transactions?status=COMPLETED')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      for (const tx of res.body.data) {
        expect(tx.status).toBe('COMPLETED');
      }
    });

    it('should respect pagination page and limit parameters', async () => {
      const page1Res = await request(app.getHttpServer())
        .get('/transactions?limit=1&page=1')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(page1Res.body.data).toHaveLength(1);
      expect(page1Res.body.meta.limit).toBe(1);
      expect(page1Res.body.meta.page).toBe(1);
      expect(page1Res.body.meta.hasNextPage).toBe(true);
      expect(page1Res.body.meta.hasPreviousPage).toBe(false);

      const page2Res = await request(app.getHttpServer())
        .get('/transactions?limit=1&page=2')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(page2Res.body.data).toHaveLength(1);
      expect(page2Res.body.meta.page).toBe(2);
      expect(page2Res.body.meta.hasPreviousPage).toBe(true);
      expect(page1Res.body.data[0].id).not.toBe(page2Res.body.data[0].id);
    });

    it('should filter transactions by date range', async () => {
      const currentYear = new Date().getFullYear();
      const currentRes = await request(app.getHttpServer())
        .get(`/transactions?startDate=${currentYear}-01-01&endDate=${currentYear}-12-31`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(currentRes.body.data.length).toBeGreaterThanOrEqual(2);

      const pastRes = await request(app.getHttpServer())
        .get('/transactions?startDate=2015-01-01&endDate=2015-01-31')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(pastRes.body.data).toHaveLength(0);
      expect(pastRes.body.meta.total).toBe(0);
    });

    it('should isolate ledger data so User B only sees their own transactions', async () => {
      const resB = await request(app.getHttpServer())
        .get('/transactions')
        .set('Authorization', `Bearer ${userBToken}`)
        .expect(200);

      expect(resB.body.data.length).toBeGreaterThanOrEqual(1);
      for (const tx of resB.body.data) {
        expect(tx.type).toBe('TRANSFER_IN');
      }
    });
  });

  describe('GET /transactions/:id', () => {
    it('should reject with 401 Unauthorized if no Bearer token is provided', async () => {
      await request(app.getHttpServer())
        .get(`/transactions/${userATransferOutId}`)
        .expect(401);
    });

    it('should reject with 400 Bad Request if transaction ID is not a valid UUID', async () => {
      await request(app.getHttpServer())
        .get('/transactions/not-a-valid-uuid')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(400);
    });

    it('should retrieve single transaction details by ID for the owner', async () => {
      const res = await request(app.getHttpServer())
        .get(`/transactions/${userATransferOutId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body.id).toBe(userATransferOutId);
      expect(res.body.type).toBe('TRANSFER_OUT');
      expect(res.body.amount).toBe('300.0000');
      expect(res.body.status).toBe('COMPLETED');
    });

    it('should retrieve withdrawal details by ID for the owner', async () => {
      const res = await request(app.getHttpServer())
        .get(`/transactions/${userAWithdrawalId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body.id).toBe(userAWithdrawalId);
      expect(res.body.type).toBe('WITHDRAWAL');
      expect(res.body.amount).toBe('150.0000');
      expect(res.body.status).toBe('COMPLETED');
    });

    it('should reject with 404 Not Found when User B attempts to access User A transaction (IDOR Defense)', async () => {
      await request(app.getHttpServer())
        .get(`/transactions/${userATransferOutId}`)
        .set('Authorization', `Bearer ${userBToken}`)
        .expect(404);
    });
  });
});
