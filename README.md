# 🏦 NestJS Fintech REST API

A production-grade, enterprise-ready fintech REST API built with **NestJS**, **TypeScript**, **PostgreSQL**, and **TypeORM**. 

Engineered with financial-grade consistency: **atomic transactions**, **pessimistic row-level locking** for double-spending prevention, **symmetric double-entry ledgers**, **instant session revocation**, and **audited transaction history**.

---

## 🌟 Core Features

- **🔐 Robust JWT Authentication**:
  - Stateless Access Tokens (15-min expiry) + Stateful Refresh Tokens (7-day rotation).
  - **Instant Logout (Approach B)**: Utilizes database-backed `tokenVersion` checks in `JwtStrategy` so that logging out revokes access tokens *immediately across all devices*.
  - Strong password hashing with `bcrypt`.
- **💼 Auto-Provisioned Wallets**:
  - Automatically provisions a multi-currency ready `0.0000 NGN` wallet upon registration.
  - High-precision financial balances stored in `numeric(18, 4)`.
- **⚡ Double-Spending & Race Condition Protection**:
  - **Atomic P2P Transfers**: Wrapped in ACID transactions with deterministic wallet locking order (`lockOrder = [id1, id2].sort()`) to prevent deadlock.
  - **Pessimistic Write Locking**: Utilizes PostgreSQL `SELECT ... FOR UPDATE` to eliminate race conditions and lost updates during concurrent transfers and deposits.
  - **Double-Entry Ledger**: Every transfer creates simultaneous, immutable `TRANSFER_OUT` (debit) and `TRANSFER_IN` (credit) audit records.
- **📜 Audited Transaction History**:
  - Indexed queries on `(wallet_id, createdAt DESC)` for sub-5ms lookups.
  - Comprehensive filtering: filter by transaction `type` (`DEPOSIT`, `TRANSFER_IN`, `TRANSFER_OUT`, `WITHDRAWAL`), `status` (`COMPLETED`, `PENDING`, `FAILED`), and date boundaries (`startDate`, `endDate`).
  - Zero-reconnaissance IDOR protection (returns `404 Not Found` for foreign records).
- **🛡️ Production Security & CORS**:
  - Configurable CORS with credential support (`origin: true` in dev, domain whitelisting in production).
  - Rate limiting with `@nestjs/throttler`.
  - Global `ValidationPipe` with input whitelisting and sanitization.
- **📖 Interactive Swagger UI (OpenAPI 3.0)**:
  - Full API exploration and "Try it out" interactive console at `/api/docs`.
  - Protected with HTTP Basic Authentication against automated bot reconnaissance.

---

## 🛠️ Tech Stack & Prerequisites

- **Runtime**: Node.js v20+ (v24 recommended)
- **Framework**: NestJS v11+
- **Database**: PostgreSQL 16
- **ORM**: TypeORM
- **Containerization**: Docker & Docker Compose
- **Testing**: Jest (Supertest for E2E integration)
- **Linter**: Oxlint

---

## 🚀 Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/your-org/nest-fintech-api.git
cd nest-fintech-api
```

### 2. Environment Configuration
Copy `.env.example` to create your local `.env`:
```bash
cp .env.example .env
```

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `DATABASE_HOST` | Database server host | `localhost` (or `postgres` in Docker) |
| `DATABASE_PORT` | PostgreSQL port | `5433` (Docker host port) / `5432` |
| `DATABASE_USER` | Database user | `nest_fintech_username` |
| `DATABASE_PASSWORD`| Database password | `nest_fintech_password` |
| `DATABASE_NAME` | Database name | `nest_fintech_db` |
| `PORT` | API server port | `3000` |
| `JWT_SECRET` | Secret key for access tokens | *Replace with 64-char string* |
| `JWT_REFRESH_SECRET` | Secret key for refresh tokens | *Replace with 64-char string* |
| `JWT_EXPIRES` | Access token duration | `15m` |
| `JWT_REFRESH_EXPIRES`| Refresh token duration | `7d` |
| `SWAGGER_USER` | Swagger UI documentation login | `admin` |
| `SWAGGER_PASSWORD` | Swagger UI documentation password | `secret123` |
| `FRONTEND_URL` | Allowed CORS origins (comma-separated)| `http://localhost:3000,http://localhost:5173` |

---

## 🐳 Running with Docker Compose (Recommended)

Start the entire stack (PostgreSQL + NestJS API in watch mode):
```bash
docker compose up -d --build
```

- API Server: `http://localhost:3000`
- Swagger Docs: `http://localhost:3000/api/docs`
- PostgreSQL Port: `5433`

To view live container logs:
```bash
docker compose logs -f api
```

To stop containers:
```bash
docker compose down
```

---

## 💻 Running Locally (Node.js)

### 1. Install Dependencies
```bash
npm install
```

### 2. Start PostgreSQL
If not using Docker for the API, start only the database:
```bash
docker compose up -d postgres
```

### 3. Run Database Migrations
```bash
npm run migration:run
```

### 4. Start the Application
```bash
# Development (with file watch)
npm run start:dev

# Production build & start
npm run build
npm run start:prod
```

---

## 🗄️ Database Migrations Guide

All database schema changes are strictly version-controlled using TypeORM migrations.

### Available Migration Commands

```bash
# Run all pending migrations
npm run migration:run

# Rollback the last executed migration
npm run migration:revert

# Reset database from scratch (Laravel `migrate:fresh` equivalent)
npm run migration:fresh

# Generate a new migration by diffing entities against active DB
npm run migration:generate -- src/database/migrations/<MigrationName>
```

> [!IMPORTANT]
> **Production Safety Guard in `migration:fresh`**:
> The `migration:fresh` script includes an inline environment check:
> ```bash
> if (process.env.NODE_ENV === "production") abort;
> ```
> This guarantees that accidental execution on production servers will abort immediately without dropping tables or losing financial data!

---

## 🧪 Testing Suite (100% Pass Rate)

The repository includes comprehensive Unit and E2E integration test suites:

```bash
# Run unit tests (32 tests covering services & business logic)
npm test

# Run E2E integration tests against real PostgreSQL database (46 tests)
npm run test:e2e

# Run linter
npm run lint
```

### Key Test Coverage Areas:
- **P2P Transfer Atomic Isolation**: Verifies simultaneous balance debit/credit and ledger generation.
- **Double-Spending Stress Test**: Fires 5 concurrent requests against an insufficient balance; asserts only valid transfers succeed while overdrafts are cleanly rejected.
- **Instant Logout Assertion**: Asserts that an access token is immediately rejected with `401 Unauthorized` on its very next call after logging out.
- **Zero-Reconnaissance IDOR**: Verifies that querying another tenant's transaction ID returns `404 Not Found`.

---

## 📖 API Documentation & Swagger UI

Once the application is running, navigate to:
👉 **[http://localhost:3000/api/docs](http://localhost:3000/api/docs)**

When prompted by the browser for credentials, enter:
- **Username**: `admin` *(or value in `.env` `SWAGGER_USER`)*
- **Password**: `secret123` *(or value in `.env` `SWAGGER_PASSWORD`)*

### Quick API Endpoint Reference

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `POST` | `/auth/register` | Register new user + auto-provision wallet | No |
| `POST` | `/auth/login` | Authenticate & receive access/refresh tokens | No |
| `POST` | `/auth/refresh` | Rotate access & refresh token pair | No |
| `POST` | `/auth/logout` | Revoke session & increment `tokenVersion` | Bearer JWT |
| `GET` | `/users/profile` | Get authenticated user profile | Bearer JWT |
| `GET` | `/wallet/balance` | Get wallet balance & currency | Bearer JWT |
| `POST` | `/wallet/fund` | Atomically fund wallet & create `DEPOSIT` receipt | Bearer JWT |
| `POST` | `/transfers/send` | Atomic P2P transfer with row locking | Bearer JWT |
| `POST` | `/transfers/withdraw` | Withdraw funds to external destination | Bearer JWT |
| `GET` | `/transactions` | Paginated transaction history with type/date filters | Bearer JWT |
| `GET` | `/transactions/:id`| Look up transaction receipt (IDOR protected) | Bearer JWT |
