import { Injectable } from '@nestjs/common';
import {v2 as cloudinary, UploadApiErrorResponse, UploadApiResponse} from 'cloudinary';
import { UserService } from 'src/user/user.service';

const streamifier = require('streamifier');

export type CloudinaryResponse = UploadApiResponse | UploadApiErrorResponse;

@Injectable()
export class FilesService {

    constructor(
        private readonly userService: UserService,
    ) {}

    async uploadUserImage(id: string, file: Express.Multer.File) {
        // const user = await this.userService.findOne(id);

        return new Promise<CloudinaryResponse>((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream((error, resilts)=>{
                if(error) {
                    reject(error);
                }
                resolve(resilts);
            });
            
            streamifier.createReadStream(file.buffer).pipe(uploadStream);
        });
    }
}
