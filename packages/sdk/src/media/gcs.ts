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
   * How long signed URLs remain valid in seconds. Defaults to 7 days (604800).
   * GCS signed URLs max out at 7 days.
   */
  signedUrlExpiresIn?: number;
}

export class GCSMediaProvider implements MediaProvider {
  private storage: Storage;
  private bucket: string;
  private signedUrlExpiresIn: number;

  constructor(opts: GCSMediaProviderOptions) {
    this.storage = new Storage({
      ...(opts.projectId ? { projectId: opts.projectId } : {}),
      ...(opts.credentials ? { credentials: opts.credentials } : {}),
    });
    this.bucket = opts.bucket;
    this.signedUrlExpiresIn = opts.signedUrlExpiresIn ?? 604800;
  }

  async upload(file: { buffer: Buffer; mimetype: string; filename: string }): Promise<string> {
    const ext = file.filename.split('.').pop() ?? 'bin';
    const key = `${randomUUID()}.${ext}`;
    const gcsFile = this.storage.bucket(this.bucket).file(key);

    await gcsFile.save(file.buffer, {
      resumable: false,
      metadata: { contentType: file.mimetype },
    });

    const [signedUrl] = await gcsFile.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + this.signedUrlExpiresIn * 1000,
    });

    return signedUrl;
  }
}
