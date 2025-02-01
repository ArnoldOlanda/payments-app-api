import { Module } from '@nestjs/common';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { UserModule } from 'src/user/user.module';
import { CloudinaryProvider } from 'src/files/cloudinary.provider';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [UserModule, ConfigModule.forRoot({
    isGlobal: true,
    envFilePath: `.${process.env.NODE_ENV}.env`,
  })],
  controllers: [FilesController],
  providers: [CloudinaryProvider, FilesService],
  exports: [CloudinaryProvider,FilesService],
})
export class FilesModule {}
