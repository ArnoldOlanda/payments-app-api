import { MigrationInterface, QueryRunner } from "typeorm";

export class NewInit1735216156604 implements MigrationInterface {
    name = 'NewInit1735216156604'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "zone" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying(100) NOT NULL, "description" character varying(100) NOT NULL, CONSTRAINT "PK_bd3989e5a3c3fb5ed546dfaf832" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "role" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying(100) NOT NULL, "description" character varying(100) NOT NULL, CONSTRAINT "PK_b36bcfe02fc8de3c57a8b2391c2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "user" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "role_id" uuid NOT NULL, "name" character varying(100) NOT NULL, "email" character varying(100) NOT NULL, "password" character varying(255) NOT NULL, "roleIdId" uuid, CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "user_zones_zone" ("userId" uuid NOT NULL, "zoneId" uuid NOT NULL, CONSTRAINT "PK_3a93590d28716f9b25654b1265b" PRIMARY KEY ("userId", "zoneId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0def46c41b834b4a7ad6218ef6" ON "user_zones_zone" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_70bf91a9777d0abf8063fd4842" ON "user_zones_zone" ("zoneId") `);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "FK_88caf607c870c4a5f0cbbc16c86" FOREIGN KEY ("roleIdId") REFERENCES "role"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_zones_zone" ADD CONSTRAINT "FK_0def46c41b834b4a7ad6218ef63" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "user_zones_zone" ADD CONSTRAINT "FK_70bf91a9777d0abf8063fd48423" FOREIGN KEY ("zoneId") REFERENCES "zone"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_zones_zone" DROP CONSTRAINT "FK_70bf91a9777d0abf8063fd48423"`);
        await queryRunner.query(`ALTER TABLE "user_zones_zone" DROP CONSTRAINT "FK_0def46c41b834b4a7ad6218ef63"`);
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_88caf607c870c4a5f0cbbc16c86"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_70bf91a9777d0abf8063fd4842"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0def46c41b834b4a7ad6218ef6"`);
        await queryRunner.query(`DROP TABLE "user_zones_zone"`);
        await queryRunner.query(`DROP TABLE "user"`);
        await queryRunner.query(`DROP TABLE "role"`);
        await queryRunner.query(`DROP TABLE "zone"`);
    }

}
