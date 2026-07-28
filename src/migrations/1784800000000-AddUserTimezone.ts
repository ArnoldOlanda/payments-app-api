import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the per-user IANA timezone column.
 *
 * - Type: varchar(64) — IANA identifiers fit comfortably (longest real one is ~32 chars).
 * - Default: 'UTC' — backwards-compatible for all existing users.
 * - NOT NULL — every user has a timezone; we never want NULL here.
 *
 * Existing rows are backfilled with 'UTC' automatically by the column default.
 */
export class AddUserTimezone1784800000000 implements MigrationInterface {
  name = 'AddUserTimezone1784800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "timezone" varchar(64) NOT NULL DEFAULT 'UTC'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN IF EXISTS "timezone"`,
    );
  }
}
