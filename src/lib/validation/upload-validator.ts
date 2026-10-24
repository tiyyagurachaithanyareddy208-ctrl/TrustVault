import path from 'path';
import { ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '@/lib/constants';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export interface FileValidationResult {
  isValid: boolean;
  sanitizedFilename: string;
  detectedMimeType: string;
  fileSize: number;
  error?: string;
}

/**
 * Validates magic numbers (file signatures) to detect MIME-spoofing attacks.
 */
export function verifyMagicBytes(buffer: Buffer, declaredMimeType: string): { matches: boolean; detectedMime: string } {
  if (buffer.length < 4) {
    return { matches: false, detectedMime: 'unknown/too-short' };
  }

  // 1. PDF signature: %PDF (25 50 44 46)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return {
      matches: declaredMimeType === 'application/pdf',
      detectedMime: 'application/pdf',
    };
  }

  // 2. PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) {
    return {
      matches: declaredMimeType === 'image/png',
      detectedMime: 'image/png',
    };
  }

  // 3. JPEG signature: FF D8 FF
  if (
    buffer[0] === 0xFF &&
    buffer[1] === 0xD8 &&
    buffer[2] === 0xFF
  ) {
    return {
      matches: declaredMimeType === 'image/jpeg' || declaredMimeType === 'image/jpg',
      detectedMime: 'image/jpeg',
    };
  }

  // 4. DOCX / XLSX (Office Open XML ZIP container): 50 4B 03 04
  if (
    buffer[0] === 0x50 &&
    buffer[1] === 0x4B &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  ) {
    const isOfficeDoc =
      declaredMimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      declaredMimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    return {
      matches: isOfficeDoc,
      detectedMime: isOfficeDoc ? declaredMimeType : 'application/zip',
    };
  }

  return { matches: false, detectedMime: 'application/octet-stream' };
}

/**
 * Sanitizes original user filename to eliminate path traversal and double extension attacks.
 */
export function sanitizeFilename(filename: string): string {
  // Strip null bytes and path delimiters
  let clean = path.basename(filename.replace(/[\0\r\n\t]/g, '').trim());
  clean = clean.replace(/\\/g, '/').split('/').pop() || 'unnamed_document';

  // Extract base and extension
  const ext = path.extname(clean).toLowerCase();
  const base = path.basename(clean, ext);

  // Strip non-alphanumeric/safe characters from the base name
  const sanitizedBase = base.replace(/[^a-zA-Z0-9_\-\. ]/g, '_').trim().slice(0, 100);
  const safeBase = sanitizedBase.length > 0 ? sanitizedBase : 'document';

  return `${safeBase}${ext}`;
}

/**
 * Comprehensive server-side file upload validator.
 */
export function validateUploadedFile(
  buffer: Buffer,
  declaredFilename: string,
  declaredMimeType: string
): FileValidationResult {
  // 1. File size check
  if (!buffer || buffer.length === 0) {
    return {
      isValid: false,
      sanitizedFilename: '',
      detectedMimeType: '',
      fileSize: 0,
      error: 'File payload is empty (0 bytes).',
    };
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return {
      isValid: false,
      sanitizedFilename: '',
      detectedMimeType: '',
      fileSize: buffer.length,
      error: `File size exceeds the maximum limit of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`,
    };
  }

  // 2. Filename and extension check
  const sanitized = sanitizeFilename(declaredFilename);
  const ext = path.extname(sanitized).toLowerCase() as (typeof ALLOWED_EXTENSIONS)[number];

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      isValid: false,
      sanitizedFilename: sanitized,
      detectedMimeType: '',
      fileSize: buffer.length,
      error: `Disallowed file extension '${ext}'. Allowed extensions are: ${ALLOWED_EXTENSIONS.join(', ')}`,
    };
  }

  // 3. MIME type allowlist check
  if (!ALLOWED_MIME_TYPES.includes(declaredMimeType as (typeof ALLOWED_MIME_TYPES)[number])) {
    return {
      isValid: false,
      sanitizedFilename: sanitized,
      detectedMimeType: declaredMimeType,
      fileSize: buffer.length,
      error: `Disallowed MIME type '${declaredMimeType}'.`,
    };
  }

  // 4. File signature / Magic-byte verification
  const magicCheck = verifyMagicBytes(buffer, declaredMimeType);
  if (!magicCheck.matches) {
    return {
      isValid: false,
      sanitizedFilename: sanitized,
      detectedMimeType: magicCheck.detectedMime,
      fileSize: buffer.length,
      error: `MIME type spoofing detected: file signature indicates '${magicCheck.detectedMime}' but '${declaredMimeType}' was claimed.`,
    };
  }

  return {
    isValid: true,
    sanitizedFilename: sanitized,
    detectedMimeType: magicCheck.detectedMime,
    fileSize: buffer.length,
  };
}
