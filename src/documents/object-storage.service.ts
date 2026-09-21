import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ObjectStorageService {
  private readonly bucket: string;
  private readonly client: S3Client;
  private bucketReady?: Promise<void>;

  constructor(config: ConfigService) {
    const endpoint = config.getOrThrow<string>('MINIO_ENDPOINT');
    this.bucket = config.getOrThrow<string>('MINIO_BUCKET');
    this.client = new S3Client({
      endpoint,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.getOrThrow<string>('MINIO_ACCESS_KEY'),
        secretAccessKey: config.getOrThrow<string>('MINIO_SECRET_KEY'),
      },
    });
  }

  async put(key: string, file: Express.Multer.File, contentHash: string): Promise<void> {
    await this.ensureBucket();
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: file.buffer,
      ContentLength: file.size,
      ContentType: file.mimetype,
      Metadata: {
        sha256: contentHash,
        original_filename: encodeURIComponent(file.originalname),
      },
    }));
  }

  async remove(key: string): Promise<void> {
    await this.ensureBucket();
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  private async ensureBucket(): Promise<void> {
    if (!this.bucketReady) {
      this.bucketReady = (async () => {
        try {
          await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
        } catch (error) {
          if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode !== 404) throw error;
          try {
            await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
          } catch (creationError) {
            if ((creationError as Error).name !== 'BucketAlreadyOwnedByYou') throw creationError;
          }
        }
      })().catch((error) => {
        this.bucketReady = undefined;
        throw error;
      });
    }
    await this.bucketReady;
  }
}
