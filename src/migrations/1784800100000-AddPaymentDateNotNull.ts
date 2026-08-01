import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Forces `payment.date` to NOT NULL.
 */
export class AddPaymentDateNotNull1784800100000 implements MigrationInterface {
  name = 'AddPaymentDateNotNull1784800100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "payment" SET "date" = "createdAt" WHERE "date" IS NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "payment" ALTER COLUMN "date" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payment" ALTER COLUMN "date" DROP NOT NULL`,
    );
  }
}
