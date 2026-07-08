import {
  Controller,
  FileTypeValidator,
  ForbiddenException,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FilesService } from './files.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { ValidRole } from 'src/auth/enums/validRoles.enum';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { Actor } from 'src/auth/types/actor.type';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('/user/image/:id')
  @Auth(ValidRole.ADMIN, ValidRole.PRESTAMISTA)
  @UseInterceptors(FileInterceptor('file'))
  uploadUserImage(
    @Param('id') id: string,
    @CurrentUser() actor: Actor,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 4 }), // 4MB
          new FileTypeValidator({ fileType: '.(jpg|jpeg|png)' }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    if (actor.role !== ValidRole.ADMIN && actor.id !== id) {
      throw new ForbiddenException(
        'You can only upload images for your own user',
      );
    }
    return this.filesService.uploadUserImage(id, file);
  }
}
