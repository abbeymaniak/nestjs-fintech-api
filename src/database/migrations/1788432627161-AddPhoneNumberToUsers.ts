import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPhoneNumberToUsers1788432627161 implements MigrationInterface {
    name = 'AddPhoneNumberToUsers1788432627161'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "phoneNumber" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "phoneNumber"`);
    }

}
