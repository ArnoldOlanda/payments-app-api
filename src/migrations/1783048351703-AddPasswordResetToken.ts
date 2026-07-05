import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPasswordResetToken1783048351703 implements MigrationInterface {
  name = 'AddPasswordResetToken1783048351703';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "password_reset_token" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "tokenHash" character varying(64) NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "usedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_838af121380dfe3a6330e04f5bb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a4e53583f7a8ab7d01cded46a4" ON "password_reset_token" ("userId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_324e592c57094c9dcfa00ddf91" ON "password_reset_token" ("tokenHash") `,
    );
    await queryRunner.query(
      `ALTER TABLE "password_reset_token" ADD CONSTRAINT "FK_a4e53583f7a8ab7d01cded46a41" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "password_reset_token" DROP CONSTRAINT "FK_a4e53583f7a8ab7d01cded46a41"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_324e592c57094c9dcfa00ddf91"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a4e53583f7a8ab7d01cded46a4"`,
    );
    await queryRunner.query(`DROP TABLE "password_reset_token"`);
  }
}
