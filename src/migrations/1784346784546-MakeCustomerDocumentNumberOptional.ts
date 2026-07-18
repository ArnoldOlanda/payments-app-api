import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeCustomerDocumentNumberOptional1784346784546
  implements MigrationInterface
{
  name = 'MakeCustomerDocumentNumberOptional1784346784546';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "customer" ALTER COLUMN "documentNumber" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "customer" ALTER COLUMN "documentNumber" SET NOT NULL`,
    );
  }
}
