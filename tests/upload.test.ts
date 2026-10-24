import { describe, it, expect } from 'vitest';
import { validateUploadedFile, sanitizeFilename, verifyMagicBytes } from '@/lib/validation/upload-validator';

describe('Upload Validation & File Signature Security Tests', () => {
  it('rejects unsupported file extensions', () => {
    const fakeBuffer = Buffer.from('%PDF-1.7 payload');
    const result = validateUploadedFile(fakeBuffer, 'malicious_script.exe', 'application/pdf');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Disallowed file extension');
  });

  it('rejects empty file payloads (0 bytes)', () => {
    const emptyBuffer = Buffer.alloc(0);
    const result = validateUploadedFile(emptyBuffer, 'empty.pdf', 'application/pdf');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('empty');
  });

  it('rejects oversized file uploads exceeding maximum size limit', () => {
    // 26 MB buffer (exceeds 25 MB limit)
    const largeBuffer = Buffer.alloc(26 * 1024 * 1024);
    const result = validateUploadedFile(largeBuffer, 'huge_file.pdf', 'application/pdf');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('exceeds the maximum limit');
  });

  it('detects and rejects MIME type spoofing (malicious binary masquerading as PDF)', () => {
    // Payload with MZ header (Windows executable) masquerading as PDF
    const exeBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00');
    const result = validateUploadedFile(exeBuffer, 'trojan.pdf', 'application/pdf');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('MIME type spoofing detected');
  });

  it('sanitizes dangerous filenames preventing path traversal attacks', () => {
    const dangerousNames = [
      '../../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\calc.exe',
      '/var/vault/secret.pdf',
      'document\0nullbyte.pdf',
    ];

    for (const name of dangerousNames) {
      const sanitized = sanitizeFilename(name);
      expect(sanitized).not.toContain('..');
      expect(sanitized).not.toContain('/');
      expect(sanitized).not.toContain('\\');
      expect(sanitized).not.toContain('\0');
    }
  });

  it('accepts legitimate files with authentic magic bytes', () => {
    // 1. Valid PDF
    const validPdfBuffer = Buffer.from('%PDF-1.7\nSample confidential text payload\n');
    const pdfResult = validateUploadedFile(validPdfBuffer, 'financial_report.pdf', 'application/pdf');
    expect(pdfResult.isValid).toBe(true);
    expect(pdfResult.detectedMimeType).toBe('application/pdf');

    // 2. Valid PNG
    const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    const pngResult = validateUploadedFile(validPngBuffer, 'diagram.png', 'image/png');
    expect(pngResult.isValid).toBe(true);
    expect(pngResult.detectedMimeType).toBe('image/png');

    // 3. Valid DOCX / XLSX (ZIP container)
    const validDocxBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);
    const docxResult = validateUploadedFile(
      validDocxBuffer,
      'contract.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    expect(docxResult.isValid).toBe(true);
  });
});
