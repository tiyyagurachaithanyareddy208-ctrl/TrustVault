export const ROLES = {
  ADMINISTRATOR: 'ADMINISTRATOR',
  DOCUMENT_OWNER: 'DOCUMENT_OWNER',
  VIEWER: 'VIEWER',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const PERMISSIONS = {
  READ: 'READ',
  EDIT: 'EDIT',
} as const;

export type PermissionLevel = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const DOCUMENT_CATEGORIES = [
  'FINANCIAL',
  'LEGAL',
  'HR',
  'SECURITY',
  'OPERATIONS',
  'GENERAL',
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

export const ALLOWED_EXTENSIONS = [
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.docx',
  '.xlsx',
] as const;

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export const AUDIT_ACTIONS = {
  AUTH_LOGIN_SUCCESS: 'AUTH_LOGIN_SUCCESS',
  AUTH_LOGIN_FAILED: 'AUTH_LOGIN_FAILED',
  AUTH_LOGOUT: 'AUTH_LOGOUT',
  DOCUMENT_UPLOAD: 'DOCUMENT_UPLOAD',
  DOCUMENT_VIEW: 'DOCUMENT_VIEW',
  DOCUMENT_DOWNLOAD: 'DOCUMENT_DOWNLOAD',
  DOCUMENT_UPDATE: 'DOCUMENT_UPDATE',
  DOCUMENT_DELETE: 'DOCUMENT_DELETE',
  PERMISSION_GRANT: 'PERMISSION_GRANT',
  PERMISSION_REVOKE: 'PERMISSION_REVOKE',
  AUTHZ_ACCESS_DENIED: 'AUTHZ_ACCESS_DENIED',
  USER_STATUS_CHANGE: 'USER_STATUS_CHANGE',
  USER_ROLE_CHANGE: 'USER_ROLE_CHANGE',
  SECURITY_VALIDATION_FAILURE: 'SECURITY_VALIDATION_FAILURE',
} as const;

export const AUDIT_OUTCOMES = {
  SUCCESS: 'SUCCESS',
  DENIED: 'DENIED',
} as const;

export const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';
