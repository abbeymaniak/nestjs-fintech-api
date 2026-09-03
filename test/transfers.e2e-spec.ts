import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('Transfers & Concurrency (e2e)', () => {
  let app: INestApplication;
  let senderToken: string;
  let senderEmail: string;
  let recipientToken: string;
  let recipientEmail: string;

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

    senderEmail = `sender_${Date.now()}@fintech.com`;
    const senderRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: senderEmail,
        password: 'Password123!',
        firstName: 'Sender',
        lastName: 'Account',
      })
      .expect(201);

    senderToken = senderRes.body.tokens.accessToken;

    recipientEmail = `recipient_${Date.now()}@fintech.com`;
    const recipientRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: recipientEmail,
        password: 'Password123!',
        firstName: 'Recipient',
        lastName: 'Account',
      })
      .expect(201);

    recipientToken = recipientRes.body.tokens.accessToken;

    await request(app.getHttpServer())
      .post('/wallet/fund')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ amount: 1000 })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /transfers/send', () => {
    it('should reject with 401 Unauthorized if no Bearer token is provided', async () => {
      await request(app.getHttpServer())
        .post('/transfers/send')
        .send({
          recipientEmail,
          amount: 100,
        })
        .expect(401);
    });

    it('should reject with 400 Bad Request if transfer amount is negative or zero', async () => {
      await request(app.getHttpServer())
        .post('/transfers/send')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({
          recipientEmail,
          amount: -50,
        })
        .expect(400);

      await request(app.getHttpServer())
        .post('/transfers/send')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({
          recipientEmail,
          amount: 0,
        })
        .expect(400);
    });

    it('should reject with 400 Bad Request on self-transfer attempt', async () => {
      const res = await request(app.getHttpServer())
        .post('/transfers/send')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({
          recipientEmail: senderEmail,
          amount: 50,
        })
        .expect(400);

      expect(res.body.message).toContain('Cannot transfer funds to yourself');
    });

    it('should reject with 404 Not Found if recipient user does not exist', async () => {
      await request(app.getHttpServer())
        .post('/transfers/send')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({
          recipientEmail: 'nonexistent@fintech.com',
          amount: 50,
        })
        .expect(404);
    });

    it('should reject with 400 Bad Request if transfer amount exceeds balance', async () => {
      const res = await request(app.getHttpServer())
        .post('/transfers/send')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({
          recipientEmail,
          amount: 5000,
        })
        .expect(400);

      expect(res.body.message).toContain('Insufficient wallet balance');
    });

    it('should successfully execute transfer and atomically update both balances', async () => {
      const res = await request(app.getHttpServer())
        .post('/transfers/send')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({
          recipientEmail,
          amount: 300,
          description: 'Payment for services',
        })
        .expect(200);

      expect(res.body).toHaveProperty('reference');
      expect(res.body.amount).toBe(300);
      expect(res.body.senderBalance).toBe('700.0000');
      expect(res.body.status).toBe('COMPLETED');

      const senderBalanceRes = await request(app.getHttpServer())
        .get('/users/wallet')
        .set('Authorization', `Bearer ${senderToken}`)
        .expect(200);

      expect(senderBalanceRes.body.balance).toBe('700.0000');

      const recipientBalanceRes = await request(app.getHttpServer())
        .get('/users/wallet')
        .set('Authorization', `Bearer ${recipientToken}`)
        .expect(200);

      expect(recipientBalanceRes.body.balance).toBe('300.0000');
    });
  });

  describe('POST /transfers/withdraw', () => {
    it('should reject with 401 Unauthorized if no Bearer token is provided', async () => {
      await request(app.getHttpServer())
        .post('/transfers/withdraw')
        .send({ amount: 100 })
        .expect(401);
    });

    it('should reject with 400 Bad Request if withdrawal amount exceeds balance', async () => {
      await request(app.getHttpServer())
        .post('/transfers/withdraw')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({ amount: 999999 })
        .expect(400);
    });

    it('should successfully withdraw funds and update balance', async () => {
      const res = await request(app.getHttpServer())
        .post('/transfers/withdraw')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({
          amount: 200,
          description: 'ATM Cash Withdrawal',
        })
        .expect(200);

      expect(res.body.remainingBalance).toBe('500.0000');
      expect(res.body.status).toBe('COMPLETED');

      const balanceRes = await request(app.getHttpServer())
        .get('/users/wallet')
        .set('Authorization', `Bearer ${senderToken}`)
        .expect(200);

      expect(balanceRes.body.balance).toBe('500.0000');
    });
  });

  describe('Concurrency Stress Test: Double-Spending Protection', () => {
    it('should prevent double-spending when 5 concurrent transfers of 50 NGN are fired against a 100 NGN balance', async () => {
      const concSenderEmail = `conc_sender_${Date.now()}@fintech.com`;
      const concSenderRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: concSenderEmail,
          password: 'Password123!',
          firstName: 'Conc',
          lastName: 'Sender',
        })
        .expect(201);

      const concSenderToken = concSenderRes.body.tokens.accessToken;

      await request(app.getHttpServer())
        .post('/wallet/fund')
        .set('Authorization', `Bearer ${concSenderToken}`)
        .send({ amount: 100 })
        .expect(200);

      const concReceiverEmail = `conc_receiver_${Date.now()}@fintech.com`;
      const concReceiverRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: concReceiverEmail,
          password: 'Password123!',
          firstName: 'Conc',
          lastName: 'Receiver',
        })
        .expect(201);

      const concReceiverToken = concReceiverRes.body.tokens.accessToken;

      const transferPromises = Array(5)
        .fill(null)
        .map(() =>
          request(app.getHttpServer())
            .post('/transfers/send')
            .set('Authorization', `Bearer ${concSenderToken}`)
            .send({
              recipientEmail: concReceiverEmail,
              amount: 50,
            }),
        );

      const responses = await Promise.all(transferPromises);

      const successfulTransfers = responses.filter((r) => r.status === 200);
      const failedTransfers = responses.filter((r) => r.status === 400);

      expect(successfulTransfers).toHaveLength(2);
      expect(failedTransfers).toHaveLength(3);

      const finalSenderWallet = await request(app.getHttpServer())
        .get('/users/wallet')
        .set('Authorization', `Bearer ${concSenderToken}`)
        .expect(200);

      expect(finalSenderWallet.body.balance).toBe('0.0000');

      const finalReceiverWallet = await request(app.getHttpServer())
        .get('/users/wallet')
        .set('Authorization', `Bearer ${concReceiverToken}`)
        .expect(200);

      expect(finalReceiverWallet.body.balance).toBe('100.0000');
    });
  });
});
