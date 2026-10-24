import { NextResponse } from 'next/server';
import { AuthenticationError, AuthorizationError, ResourceNotFoundError } from './auth/authorization';
import { ValidationError } from './validation/upload-validator';
import { PathTraversalError } from './storage/storage-service';
import { AuditPersistenceError } from './audit/audit-service';

export function jsonSuccess<T>(data: T, status = 200, headers?: Record<string, string>) {
  return NextResponse.json(
    { success: true, data },
    {
      status,
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
        ...headers,
      },
    }
  );
}

export function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    {
      success: false,
      error: {
        message,
        status,
        ...(details ? { details } : {}),
      },
    },
    {
      status,
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
      },
    }
  );
}

export function handleApiError(err: unknown) {
  if (err instanceof AuthenticationError) {
    return jsonError(err.message, 401);
  }
  if (err instanceof AuthorizationError) {
    return jsonError(err.message, err.statusCode || 403);
  }
  if (err instanceof ResourceNotFoundError) {
    return jsonError('Document not found.', 404);
  }
  if (err instanceof ValidationError) {
    return jsonError(err.message, 400);
  }
  if (err instanceof PathTraversalError) {
    return jsonError('Invalid request parameters.', 400);
  }
  if (err instanceof AuditPersistenceError) {
    return jsonError(err.message, 500);
  }

  const message = err instanceof Error ? err.message : 'Internal Server Error';
  console.error('[API_ERROR]', err);
  return jsonError('An unexpected error occurred.', 500);
}
