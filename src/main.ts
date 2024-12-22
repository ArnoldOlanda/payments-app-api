import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import * as morgan from 'morgan';
import { Logger } from '@nestjs/common';
import { CORS } from './constants';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(morgan('dev'));
  app.enableCors(CORS);
  app.setGlobalPrefix('api/v1');
  const port = app.get(ConfigService).get('PORT');
  
  Logger.log(`Server started on port ${port}`);
  await app.listen(port ?? 3000);
}
bootstrap();
