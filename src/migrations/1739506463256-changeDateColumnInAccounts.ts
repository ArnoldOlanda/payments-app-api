import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangeDateColumnInAccounts1739506463256 implements MigrationInterface {
    name = 'ChangeDateColumnInAccounts1739506463256'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "account" DROP COLUMN "date"`);
        await queryRunner.query(`ALTER TABLE "account" ADD "date" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "account" DROP COLUMN "dueDate"`);
        await queryRunner.query(`ALTER TABLE "account" ADD "dueDate" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "account" DROP COLUMN "dueDate"`);
        await queryRunner.query(`ALTER TABLE "account" ADD "dueDate" date NOT NULL`);
        await queryRunner.query(`ALTER TABLE "account" DROP COLUMN "date"`);
        await queryRunner.query(`ALTER TABLE "account" ADD "date" date NOT NULL`);
    }

}
