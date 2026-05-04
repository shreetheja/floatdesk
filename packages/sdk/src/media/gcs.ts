import { Storage } from '@google-cloud/storage';
import { randomUUID } from 'crypto';
import type { MediaProvider } from '../types.js';

export interface GCSMediaProviderOptions {
  /** Optional — inferred from credentials or GOOGLE_CLOUD_PROJECT env var when omitted. */
  projectId?: string;
  bucket: string;
  /**
   * Service account credentials. If omitted, falls back to Application Default Credentials
   * (GOOGLE_APPLICATION_CREDENTIALS env var or the GCP metadata server when running on GCP).
   */
  credentials?: {
    client_email: string;
    /** The private key string — replace literal \n with actual newlines if loading from env. */
    private_key: string;
  };
  /**
   * Base URL for public file access.
   * Defaults to https://storage.googleapis.com/<bucket>.
   * Override if you front the bucket with a CDN or custom domain.
   */
  publicBaseUrl?: string;
}

export class GCSMediaProvider implements MediaProvider {
  private storage: Storage;
  private bucket: string;
  private publicBaseUrl: string;

  constructor(opts: GCSMediaProviderOptions) {
    this.storage = new Storage({
      ...(opts.projectId ? { projectId: opts.projectId } : {}),
      ...(opts.credentials ? { credentials: opts.credentials } : {}),
    });
    this.bucket = opts.bucket;
    this.publicBaseUrl = opts.publicBaseUrl ?? `https://storage.googleapis.com/${opts.bucket}`;
  }

  async upload(file: { buffer: Buffer; mimetype: string; filename: string }): Promise<string> {
    const ext = file.filename.split('.').pop() ?? 'bin';
    const key = `floatdesk/${randomUUID()}.${ext}`;

    await this.storage.bucket(this.bucket).file(key).save(file.buffer, {
      resumable: false,
      metadata: { contentType: file.mimetype },
      predefinedAcl: 'publicRead',
    });

    return `${this.publicBaseUrl}/${key}`;
  }
}
