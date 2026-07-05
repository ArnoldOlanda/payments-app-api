import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangeDateColumnInPayments1739500242793
  implements MigrationInterface
{
  name = 'ChangeDateColumnInPayments1739500242793';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "payment" DROP COLUMN "date"`);
    await queryRunner.query(`ALTER TABLE "payment" ADD "date" TIMESTAMP`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "payment" DROP COLUMN "date"`);
    await queryRunner.query(`ALTER TABLE "payment" ADD "date" date NOT NULL`);
  }
}
