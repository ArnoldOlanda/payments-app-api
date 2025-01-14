import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1736890725855 implements MigrationInterface {
    name = 'Init1736890725855'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "payment" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "date" date NOT NULL, "amount" double precision NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "accountId" uuid, CONSTRAINT "PK_fcaec7df5adf9cac408c686b2ab" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."account_status_enum" AS ENUM('active', 'finished', 'cancelled', 'overdue')`);
        await queryRunner.query(`CREATE TYPE "public"."account_credittype_enum" AS ENUM('semanal', 'diario', 'parasemanal', 'paralelo')`);
        await queryRunner.query(`CREATE TABLE "account" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "date" date NOT NULL, "dueDate" date NOT NULL, "amount" double precision NOT NULL, "interest" double precision NOT NULL, "remainingBalance" double precision NOT NULL DEFAULT '0', "status" "public"."account_status_enum" NOT NULL DEFAULT 'active', "creditType" "public"."account_credittype_enum" NOT NULL DEFAULT 'diario', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "customerId" uuid, CONSTRAINT "PK_54115ee388cdb6d86bb4bf5b2ea" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "customer" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "documentNumber" character varying(10) NOT NULL, "name" character varying(100) NOT NULL, "lastName" character varying(100) NOT NULL, "address" character varying(100), "phone" character varying(15), "email" character varying(50), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "zoneId" uuid, CONSTRAINT "UQ_ddf4bab2738b566e735be57145c" UNIQUE ("documentNumber"), CONSTRAINT "UQ_fdb2f3ad8115da4c7718109a6eb" UNIQUE ("email"), CONSTRAINT "PK_a7a13f4cacb744524e44dfdad32" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "zone" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_bd3989e5a3c3fb5ed546dfaf832" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "role" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_b36bcfe02fc8de3c57a8b2391c2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "user" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "email" character varying(100) NOT NULL, "password" character varying(255) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "roleId" uuid, CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "user_zones_zone" ("userId" uuid NOT NULL, "zoneId" uuid NOT NULL, CONSTRAINT "PK_3a93590d28716f9b25654b1265b" PRIMARY KEY ("userId", "zoneId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0def46c41b834b4a7ad6218ef6" ON "user_zones_zone" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_70bf91a9777d0abf8063fd4842" ON "user_zones_zone" ("zoneId") `);
        await queryRunner.query(`ALTER TABLE "payment" ADD CONSTRAINT "FK_25ee41d829b06c6e7451b89037f" FOREIGN KEY ("accountId") REFERENCES "account"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "account" ADD CONSTRAINT "FK_295cfbf4cba51e0e67a6984ab8f" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "customer" ADD CONSTRAINT "FK_ae32f1dd8f3811fbeb59ae7f87e" FOREIGN KEY ("zoneId") REFERENCES "zone"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "FK_c28e52f758e7bbc53828db92194" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_zones_zone" ADD CONSTRAINT "FK_0def46c41b834b4a7ad6218ef63" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "user_zones_zone" ADD CONSTRAINT "FK_70bf91a9777d0abf8063fd48423" FOREIGN KEY ("zoneId") REFERENCES "zone"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_zones_zone" DROP CONSTRAINT "FK_70bf91a9777d0abf8063fd48423"`);
        await queryRunner.query(`ALTER TABLE "user_zones_zone" DROP CONSTRAINT "FK_0def46c41b834b4a7ad6218ef63"`);
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_c28e52f758e7bbc53828db92194"`);
        await queryRunner.query(`ALTER TABLE "customer" DROP CONSTRAINT "FK_ae32f1dd8f3811fbeb59ae7f87e"`);
        await queryRunner.query(`ALTER TABLE "account" DROP CONSTRAINT "FK_295cfbf4cba51e0e67a6984ab8f"`);
        await queryRunner.query(`ALTER TABLE "payment" DROP CONSTRAINT "FK_25ee41d829b06c6e7451b89037f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_70bf91a9777d0abf8063fd4842"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0def46c41b834b4a7ad6218ef6"`);
        await queryRunner.query(`DROP TABLE "user_zones_zone"`);
        await queryRunner.query(`DROP TABLE "user"`);
        await queryRunner.query(`DROP TABLE "role"`);
        await queryRunner.query(`DROP TABLE "zone"`);
        await queryRunner.query(`DROP TABLE "customer"`);
        await queryRunner.query(`DROP TABLE "account"`);
        await queryRunner.query(`DROP TYPE "public"."account_credittype_enum"`);
        await queryRunner.query(`DROP TYPE "public"."account_status_enum"`);
        await queryRunner.query(`DROP TABLE "payment"`);
    }

}
