import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { v2 as cloudinary, type UploadApiResponse, type UploadApiErrorResponse } from 'cloudinary';

export type CloudinaryUploadOptions = {
  folder: string;
  resourceType?: 'image' | 'raw' | 'auto';
  publicId?: string;
};

@Injectable()
export class CloudinaryService {
  private readonly configured: boolean;

  constructor() {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    this.configured = Boolean(cloudName && apiKey && apiSecret);

    if (this.configured) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      });
    }
  }

  isConfigured() {
    return this.configured;
  }

  async uploadBuffer(
    fileBuffer: Buffer,
    options: CloudinaryUploadOptions,
  ): Promise<UploadApiResponse> {
    if (!this.configured) {
      throw new InternalServerErrorException('Cloudinary is not configured');
    }

    return new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: options.folder,
          resource_type: options.resourceType ?? 'auto',
          ...(options.publicId ? { public_id: options.publicId } : {}),
        },
        (error?: UploadApiErrorResponse, result?: UploadApiResponse) => {
          if (error || !result) {
            reject(
              new InternalServerErrorException(
                error?.message || 'Cloudinary upload failed',
              ),
            );
            return;
          }

          resolve(result);
        },
      );

      stream.end(fileBuffer);
    });
  }
}
