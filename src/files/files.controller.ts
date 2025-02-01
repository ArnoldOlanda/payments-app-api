import { Controller, FileTypeValidator, MaxFileSizeValidator, Param, ParseFilePipe, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FilesService } from './files.service';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('/user/image/:id')
  @UseInterceptors(FileInterceptor('file'))
  uploadUserImage(
    @Param('id') id: string, 
    @UploadedFile(
      new ParseFilePipe({
        validators:[
          new MaxFileSizeValidator({maxSize: 1024 * 1024 * 4}), // 4MB
          new FileTypeValidator({fileType:'.(jpg|jpeg|png)'})
        ]
      })
    ) file: Express.Multer.File
  ){
    return this.filesService.uploadUserImage(id, file);
  }
}
