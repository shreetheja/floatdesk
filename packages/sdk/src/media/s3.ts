import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import type { MediaProvider } from '../types.js';

export interface S3MediaProviderOptions {
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl?: string;
}

export class S3MediaProvider implements MediaProvider {
  private client: S3Client;
  private bucket: string;
  private publicBaseUrl: string;

  constructor(opts: S3MediaProviderOptions) {
    this.client = new S3Client({
      region: opts.region,
      credentials: {
        accessKeyId: opts.accessKeyId,
        secretAccessKey: opts.secretAccessKey,
      },
    });
    this.bucket = opts.bucket;
    this.publicBaseUrl =
      opts.publicBaseUrl ?? `https://${opts.bucket}.s3.${opts.region}.amazonaws.com`;
  }

  async upload(file: { buffer: Buffer; mimetype: string; filename: string }): Promise<string> {
    const ext = file.filename.split('.').pop() ?? 'bin';
    const key = `floatdesk/${randomUUID()}.${ext}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
    );

    return `${this.publicBaseUrl}/${key}`;
  }
}
