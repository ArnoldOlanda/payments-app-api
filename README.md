# Payments App API

Backend del sistema `Payments App`.

Esta carpeta contiene la API principal del sistema de creditos y cobranza. Expone autenticacion, usuarios, clientes, zonas, cuentas, pagos, reportes y servicios auxiliares necesarios para la operacion del negocio.

## Que hace esta API

- Autentica usuarios.
- Administra roles y usuarios.
- Administra clientes.
- Administra zonas.
- Administra cuentas o creditos.
- Registra pagos asociados a cuentas.
- Genera reportes del negocio.
- Soporta impresion y correo para procesos internos.

## Stack principal

- NestJS
- TypeScript
- TypeORM
- PostgreSQL
- JWT
- Cache Manager
- Scheduler

## Dominio del negocio

La API modela una operacion de cobranza y seguimiento de creditos.

- `customer`: clientes con documento, nombre, direccion, telefono, email y zona.
- `account`: cuentas o creditos con monto, interes, saldo pendiente, fecha de vencimiento y estado.
- `payment`: pagos aplicados a una cuenta.
- `zone`: agrupacion operativa de clientes.
- `report`: generacion de reportes y fichas de pagos.

Tambien existen tipos de credito como `diario`, `semanal`, `parasemanal` y `paralelo`.

## Relacion con el resto del workspace

- `api/`: backend central del sistema.
- `web/`: panel administrativo web para operacion interna.
- `mobile/`: aplicacion movil para uso operativo en campo.

## Estructura relevante

- `src/auth/`: autenticacion y tokens.
- `src/user/`: usuarios del sistema.
- `src/role/`: roles y permisos base.
- `src/customer/`: gestion de clientes.
- `src/zone/`: gestion de zonas.
- `src/account/`: gestion de cuentas o creditos.
- `src/payment/`: registro y consulta de pagos.
- `src/report/`: reportes y documentos PDF.
- `src/printer/`: generacion de archivos imprimibles.
- `src/mail/`: integraciones de correo.
- `src/migrations/`: migraciones de base de datos.

## Requisitos

- Node.js 20.x
- Yarn 1.22.x
- PostgreSQL

## Instalacion

```bash
yarn install
```

## Variables de entorno

Usa el archivo `.env.example` como referencia. La API carga variables segun `NODE_ENV` usando archivos como `./.dev.env` o `./.prod.env`.

## Desarrollo

```bash
yarn start:dev
```

## Build

```bash
yarn build
```

## Produccion

```bash
yarn start:prod
```

## Migraciones

```bash
yarn migration:generate
yarn migration:run
yarn migration:rollback
```

## Tests

```bash
yarn test
yarn test:e2e
yarn test:cov
```

## Notas

- El README anterior correspondia al starter generico de NestJS.
- Esta carpeta ya contiene la API real del negocio y debe documentarse como el backend central del sistema de pagos/cobranza.
