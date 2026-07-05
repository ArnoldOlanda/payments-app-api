import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRefreshToken1783276305587 implements MigrationInterface {
  name = 'AddRefreshToken1783276305587';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "refresh_token" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "tokenHash" character varying(64) NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "revokedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b575dd3c21fb0831013c909e7fe" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8e913e288156c133999341156a" ON "refresh_token" ("userId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_204f27bcee2b705b8230beaf41" ON "refresh_token" ("tokenHash") `,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_token" ADD CONSTRAINT "FK_8e913e288156c133999341156ad" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "refresh_token" DROP CONSTRAINT "FK_8e913e288156c133999341156ad"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_204f27bcee2b705b8230beaf41"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8e913e288156c133999341156a"`,
    );
    await queryRunner.query(`DROP TABLE "refresh_token"`);
  }
}
