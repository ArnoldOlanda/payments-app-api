import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Indexes backing the collections-report endpoint.
 *
 * The endpoint filters `payment` by:
 *   - `payment.date BETWEEN :from AND :to`  (always present)
 *   - `payment.userId = :userId`           (optional)
 *   - `customer.zoneId = :zoneId`          (optional)
 * and excludes soft-deleted rows.
 *
 * The existing schema already auto-indexes the FK columns
 * (`payment.accountId`, `account.customerId`, `customer.zoneId`,
 * `payment.userId`), so we only add the two partial indexes that
 * materially speed up the new report query.
 *
 *   idx_payment_date_where_alive  -> drives `payment.date BETWEEN` range scans.
 *   idx_payment_user_date         -> covers the (userId, date) compound filter.
 *
 * Partial on `deletedAt IS NULL` keeps the index lean (deletions are rare
 * and soft).
 */
export class AddCollectionsReportIndexes1785000000000
  implements MigrationInterface
{
  name = 'AddCollectionsReportIndexes1785000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_payment_date_where_alive" ` +
        `ON "payment" ("date" DESC) WHERE "deletedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_payment_user_date" ` +
        `ON "payment" ("userId", "date" DESC) WHERE "deletedAt" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_payment_user_date"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_payment_date_where_alive"`,
    );
  }
}
