import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTransactionsTable1788450854633 implements MigrationInterface {
    name = 'CreateTransactionsTable1788450854633'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."transactions_type_enum" AS ENUM('DEPOSIT', 'TRANSFER_IN', 'TRANSFER_OUT', 'WITHDRAWAL')`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_status_enum" AS ENUM('PENDING', 'COMPLETED', 'FAILED')`);
        await queryRunner.query(`CREATE TABLE "transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "wallet_id" uuid NOT NULL, "amount" numeric(18,4) NOT NULL, "type" "public"."transactions_type_enum" NOT NULL, "status" "public"."transactions_status_enum" NOT NULL DEFAULT 'COMPLETED', "reference" character varying, "description" character varying, "metadata" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a219afd8dd77ed80f5a862f1db9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b684b843e5f0bf156aacb7d032" ON "transactions"  ("wallet_id", "createdAt") `);
        await queryRunner.query(`ALTER TABLE "wallets" ALTER COLUMN "balance" SET DEFAULT '0.0000'`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_0b171330be0cb621f8d73b87a9e" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_0b171330be0cb621f8d73b87a9e"`);
        await queryRunner.query(`ALTER TABLE "wallets" ALTER COLUMN "balance" SET DEFAULT 0.0000`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b684b843e5f0bf156aacb7d032"`);
        await queryRunner.query(`DROP TABLE "transactions"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_type_enum"`);
    }

}
