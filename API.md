# TrustVault: REST API & Authorization Policy Specification (API.md)

This document provides complete technical documentation for all TrustVault REST API endpoints, detailing authorization policies, authentication requirements, request/response formats, security guarantees, and audit events generated.

---

## 1. Global Security Policies & Headers

### Authentication
- Every protected route requires a valid server-side session token.
- Supported credential transmission:
  1. `Cookie: trustvault_session=<token>` (HTTP-Only, Secure in production, SameSite=Lax).
  2. `Authorization: Bearer <token>` (For automated integration tests and programmatic API access).
- Token validation checks non-revocation, active account status (`user.isActive === true`), and expiration on every request.

### Security Response Headers
Every response includes:
- `X-Content-Type-Options: nosniff`
- `Cache-Control: no-store, max-age=0, must-revalidate`
- `X-Frame-Options: DENY`

### IDOR & Discovery Policy
- If an actor lacks permission to view a document, the server returns **`404 Not Found`** instead of `403 Forbidden` to prevent resource enumeration.
- Unauthenticated requests return **`401 Unauthorized`**.

---

## 2. API Endpoint Permission Matrix

| Endpoint | Method | Required Role | Required Document Grant | Audit Event Generated | Fail-Closed Policy |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `/api/auth/login` | POST | Anonymous | None | `AUTH_LOGIN_SUCCESS` / `FAILED` | No |
| `/api/auth/logout` | POST | Authenticated | None | `AUTH_LOGOUT` | No |
| `/api/auth/me` | GET | Authenticated | None | None | No |
| `/api/documents` | GET | Authenticated | Filtered to Authorized | None | No |
| `/api/documents` | POST | Owner / Admin | None (New Document) | `DOCUMENT_UPLOAD` | No |
| `/api/documents/:id` | GET | Authenticated | Owner or READ / EDIT | `DOCUMENT_VIEW` | No |
| `/api/documents/:id` | PATCH | Authenticated | Owner or EDIT | `DOCUMENT_UPDATE` | No |
| `/api/documents/:id` | DELETE | Authenticated | Document Owner Strictly | `DOCUMENT_DELETE` | **YES** |
| `/api/documents/:id/download` | GET | Authenticated | Owner or READ / EDIT | `DOCUMENT_DOWNLOAD` | No |
| `/api/documents/:id/permissions` | GET | Authenticated | Document Owner Strictly | None | No |
| `/api/documents/:id/permissions` | POST | Authenticated | Document Owner Strictly | `PERMISSION_GRANT` | **YES** |
| `/api/documents/:id/permissions/:pid` | DELETE | Authenticated | Document Owner Strictly | `PERMISSION_REVOKE` | **YES** |
| `/api/documents/:id/audit` | GET | Authenticated | Document Owner Strictly | None | No |
| `/api/admin/overview` | GET | Administrator | None | None | No |
| `/api/admin/users` | GET | Administrator | None | None | No |
| `/api/admin/users/:id` | PATCH | Administrator | None | `USER_STATUS_CHANGE` | **YES** |
| `/api/admin/audit` | GET | Administrator | None | None | No |
| `/api/admin/audit/verify` | GET | Administrator | None | None | No |
| `/api/users/search` | GET | Authenticated | None | None | No |
| `/api/health` | GET | Public | None | None | No |

---

## 3. Authentication Endpoints

### `POST /api/auth/login`
Authenticates a user using Argon2id password verification and establishes a session.
- **Request Body**:
  ```json
  {
    "email": "owner-a@example.test",
    "password": "OwnerASecretPass123!"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "token": "7a8b9c... (64 hex characters)",
      "user": {
        "id": "e4b6c8d0-...",
        "email": "owner-a@example.test",
        "name": "Alice Owner",
        "role": "DOCUMENT_OWNER"
      }
    }
  }
  ```
- **Error Responses**:
  - `401 Unauthorized`: Invalid email or password.
  - `403 Forbidden`: Account is deactivated.
  - `423 Locked`: Account temporarily locked after 5 consecutive failed attempts.
- **Audit Generated**: `AUTH_LOGIN_SUCCESS` (on success) or `AUTH_LOGIN_FAILED` (on failure).

---

### `POST /api/auth/logout`
Revokes the current session token in the database and clears the session cookie.
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": { "message": "Successfully logged out." }
  }
  ```
- **Audit Generated**: `AUTH_LOGOUT`.

---

### `GET /api/auth/me`
Retrieves current authenticated user identity and active role.
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "e4b6c8d0-...",
        "email": "owner-a@example.test",
        "name": "Alice Owner",
        "role": "DOCUMENT_OWNER",
        "isActive": true
      }
    }
  }
  ```
- **Error Responses**:
  - `401 Unauthorized`: Missing or invalid session.

---

## 4. Document Endpoints

### `GET /api/documents`
Lists discoverable documents. Non-administrators discover only owned documents or documents explicitly granted to them. Administrators view system-wide document metadata.
- **Query Parameters**:
  - `search` (string): Filters title, description, and filename.
  - `category` (string): Classification filter (`FINANCIAL`, `LEGAL`, `HR`, `SECURITY`, `OPERATIONS`, `GENERAL`).
  - `page` (integer, default 1).
  - `limit` (integer, default 20, max 100).
  - `sort` (string: `createdAt`, `title`, `category`, `fileSize`).
  - `order` (string: `asc`, `desc`).
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "items": [
        {
          "id": "05d80cfe-...",
          "title": "Q3 Financial Audit Report",
          "originalFilename": "q3_financial_audit.pdf",
          "category": "FINANCIAL",
          "mimeType": "application/pdf",
          "fileSize": 1048576,
          "sha256Hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          "isOwner": true,
          "effectivePermission": "OWNER",
          "createdAt": "2026-10-24T18:00:00.000Z"
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 20,
        "total": 1,
        "totalPages": 1
      }
    }
  }
  ```

---

### `POST /api/documents`
Uploads a new confidential document to private storage. Validates magic bytes, file extensions, and file size on the server.
- **Request**: `multipart/form-data`
  - `file`: Binary file payload (`.pdf`, `.png`, `.jpg`, `.docx`, `.xlsx`, max 25MB).
  - `title`: Document title string.
  - `description`: Optional context notes.
  - `category`: Classification category.
- **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "cbeaba0c-...",
      "title": "Executive Security Architecture",
      "originalFilename": "executive_security_architecture.pdf",
      "category": "SECURITY",
      "mimeType": "application/pdf",
      "fileSize": 204800,
      "sha256Hash": "a1b2c3...",
      "createdAt": "2026-10-24T18:15:00.000Z"
    }
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Disallowed extension, empty file, oversized upload, or MIME-type spoofing detected.
  - `403 Forbidden`: Viewers cannot upload documents.
- **Audit Generated**: `DOCUMENT_UPLOAD` (on success) or `SECURITY_VALIDATION_FAILURE` (on spoofing/rejection).

---

### `GET /api/documents/:id`
Retrieves document metadata. Requires explicit READ access or Ownership.
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "cbeaba0c-...",
      "title": "Executive Security Architecture",
      "originalFilename": "executive_security_architecture.pdf",
      "category": "SECURITY",
      "mimeType": "application/pdf",
      "fileSize": 204800,
      "sha256Hash": "a1b2c3...",
      "isOwner": true,
      "effectivePermission": "OWNER",
      "permissions": []
    }
  }
  ```
- **Error Responses**:
  - `404 Not Found`: Returned uniformly if document does not exist or user lacks authorization.
- **Audit Generated**: `DOCUMENT_VIEW`.

---

### `GET /api/documents/:id/download`
Streams the verified file payload from server-side private storage.
- **Response**: Binary file stream with security headers:
  - `Content-Type: <mimeType>`
  - `Content-Disposition: attachment; filename="<originalFilename>"`
  - `X-Content-Type-Options: nosniff`
  - `Cache-Control: private, no-cache, no-store, must-revalidate`
- **Error Responses**:
  - `404 Not Found`: Returns zero file bytes if user lacks authorization.
- **Audit Generated**: `DOCUMENT_DOWNLOAD`.

---

### `PATCH /api/documents/:id`
Updates document title, description, or category. Requires Owner or EDIT grant.
- **Request Body**:
  ```json
  {
    "title": "Updated Financial Analysis",
    "category": "FINANCIAL"
  }
  ```
- **Success Response (200 OK)**: Returns updated metadata.
- **Audit Generated**: `DOCUMENT_UPDATE`.

---

### `DELETE /api/documents/:id`
Purges file payload from private storage and removes document record. Strictly restricted to Document Owner.
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": { "message": "Document deleted successfully." }
  }
  ```
- **Fail-Closed Policy**: If audit event persistence fails, the deletion aborts.
- **Audit Generated**: `DOCUMENT_DELETE`.

---

## 5. Permission & Grant Endpoints

### `POST /api/documents/:id/permissions`
Grants named user READ or EDIT access. Restricted to Document Owner.
- **Request Body**:
  ```json
  {
    "granteeEmail": "viewer-a@example.test",
    "permission": "READ"
  }
  ```
- **Success Response (201 Created)**: Returns created permission record.
- **Fail-Closed Policy**: If audit write fails, grant creation fails.
- **Audit Generated**: `PERMISSION_GRANT`.

---

### `DELETE /api/documents/:id/permissions/:permissionId`
Revokes an existing named permission grant. Takes effect immediately on the next request.
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": { "message": "Permission access revoked successfully." }
  }
  ```
- **Fail-Closed Policy**: If audit write fails, revocation aborts.
- **Audit Generated**: `PERMISSION_REVOKE`.

---

## 6. Administration & Audit Endpoints

### `GET /api/admin/overview`
Retrieves aggregated metrics, active user counts, security alerts, and audit chain status. Restricted to Administrator.
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "metrics": {
        "totalUsers": 5,
        "activeUsers": 5,
        "totalDocuments": 5,
        "deniedEventsCount": 0,
        "chainValid": true,
        "totalAuditEvents": 9
      },
      "categoryBreakdown": [
        { "category": "FINANCIAL", "count": 1 }
      ],
      "recentSecurityEvents": [],
      "chainStatus": {
        "isValid": true,
        "totalEvents": 9,
        "chainHeadHash": "c6cbd5..."
      }
    }
  }
  ```

---

### `PATCH /api/admin/users/:id`
Modifies a user's role or active status. If deactivated, all active sessions for that user are immediately invalidated.
- **Request Body**:
  ```json
  {
    "isActive": false
  }
  ```
- **Success Response (200 OK)**: Returns updated user profile.
- **Audit Generated**: `USER_STATUS_CHANGE`.

---

### `GET /api/admin/audit/verify`
Triggers full sequential cryptographic recomputation of all SHA-256 blocks from genesis to chain head.
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "verification": {
        "isValid": true,
        "totalEvents": 14,
        "lastSequence": 14,
        "chainHeadHash": "d0c12d40f...",
        "verifiedAt": "2026-10-24T18:30:00.000Z",
        "errors": []
      }
    }
  }
  ```
- **Detection Capabilities**: Detects altered event payloads, broken block link hashes, sequence omissions, and chain head desynchronization.
