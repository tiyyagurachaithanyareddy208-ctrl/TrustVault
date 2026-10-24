import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface StorageAdapter {
  save(buffer: Buffer, storageKey: string): Promise<void>;
  read(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<void>;
  exists(storageKey: string): Promise<boolean>;
}

export class PathTraversalError extends Error {
  constructor(message = 'Invalid storage key: potential path traversal detected') {
    super(message);
    this.name = 'PathTraversalError';
  }
}

/**
 * Validates that a storage key is a clean UUID and strictly remains within the vault directory.
 */
function sanitizeAndResolvePath(baseDir: string, storageKey: string): string {
  // Enforce strict UUID format for storage keys to completely eliminate path traversal
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(storageKey)) {
    throw new PathTraversalError(`Storage key does not match required safe format: ${storageKey}`);
  }

  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(resolvedBase, storageKey);

  if (!resolvedTarget.startsWith(resolvedBase + path.sep) && resolvedTarget !== resolvedBase) {
    throw new PathTraversalError();
  }

  return resolvedTarget;
}

export class LocalStorageAdapter implements StorageAdapter {
  private baseDir: string;

  constructor(baseDir = process.env.LOCAL_STORAGE_DIR || './storage/vault_files') {
    this.baseDir = path.resolve(process.cwd(), baseDir);
    if (!fsSync.existsSync(this.baseDir)) {
      fsSync.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  async save(buffer: Buffer, storageKey: string): Promise<void> {
    const filePath = sanitizeAndResolvePath(this.baseDir, storageKey);
    await fs.writeFile(filePath, buffer, { mode: 0o600 }); // Restrict file permissions
  }

  async read(storageKey: string): Promise<Buffer> {
    const filePath = sanitizeAndResolvePath(this.baseDir, storageKey);
    return await fs.readFile(filePath);
  }

  async delete(storageKey: string): Promise<void> {
    const filePath = sanitizeAndResolvePath(this.baseDir, storageKey);
    try {
      await fs.unlink(filePath);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }
  }

  async exists(storageKey: string): Promise<boolean> {
    const filePath = sanitizeAndResolvePath(this.baseDir, storageKey);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

// Default storage adapter instance
export const storage = new LocalStorageAdapter();

/**
 * Computes SHA-256 hash of a file buffer.
 */
export function computeSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Generates an opaque, cryptographically random internal storage key.
 */
export function generateStorageKey(): string {
  return crypto.randomUUID();
}
