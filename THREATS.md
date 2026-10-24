# TrustVault: Comprehensive Threat Model (THREATS.md)

This threat model outlines the primary attack vectors evaluated against TrustVault, detailing attacker capabilities, affected assets, severity ratings, implemented mitigations, code references, automated test verifications, and residual risks.

---

## Threat Matrix Summary

| Threat ID | Threat / Attack Scenario | Severity | Mitigation Status | Code Location | Verified Test |
| :--- | :--- | :---: | :---: | :--- | :--- |
| **THR-01** | Insecure Direct Object Reference (IDOR) on Document Read | **CRITICAL** | Fully Mitigated | `src/lib/auth/authorization.ts` | `tests/authorization.test.ts` |
| **THR-02** | Insecure Direct Downloads / Storage Key Guessing | **CRITICAL** | Fully Mitigated | `src/app/api/documents/[id]/download/route.ts` | `tests/authorization.test.ts` |
| **THR-03** | Privilege Escalation to Administrator Controls | **CRITICAL** | Fully Mitigated | `src/lib/auth/authorization.ts` | `tests/admin.test.ts` |
| **THR-04** | Unauthorized Administrative Read/Download Bypass | **HIGH** | Fully Mitigated | `src/lib/auth/authorization.ts` | `tests/admin.test.ts` |
| **THR-05** | Stale Permissions & Delayed Revocation Exploitation | **HIGH** | Fully Mitigated | `src/app/api/documents/[id]/permissions/[permissionId]/route.ts` | `tests/authorization.test.ts` |
| **THR-06** | Session Hijacking & Account Deactivation Bypass | **HIGH** | Fully Mitigated | `src/lib/auth/session.ts` | `tests/auth.test.ts` |
| **THR-07** | Password Brute-Force & Credential Stuffing | **HIGH** | Fully Mitigated | `src/lib/auth/password.ts`, `src/app/api/auth/login/route.ts` | `tests/auth.test.ts` |
| **THR-08** | Audit Log Modification & Record Tampering | **CRITICAL** | Fully Mitigated | `src/lib/audit/audit-service.ts` | `tests/audit.test.ts` |
| **THR-09** | Audit Log Deletion & Block Omission | **HIGH** | Fully Mitigated | `src/lib/audit/audit-service.ts` | `tests/audit.test.ts` |
| **THR-10** | Concurrent Audit Trail Race Condition | **MEDIUM** | Fully Mitigated | `src/lib/audit/audit-service.ts` | `tests/audit.test.ts` |
| **THR-11** | Audit Log Forgery (Untrusted Actor ID Injection) | **HIGH** | Fully Mitigated | `src/lib/audit/audit-service.ts` | `tests/audit.test.ts` |
| **THR-12** | Sensitive Information Leakage in Audit Trails | **MEDIUM** | Fully Mitigated | `src/lib/audit/audit-service.ts` | `tests/audit.test.ts` |
| **THR-13** | MIME-Type Spoofing (Polyglot / Executable Upload) | **HIGH** | Fully Mitigated | `src/lib/validation/upload-validator.ts` | `tests/upload.test.ts` |
| **THR-14** | Path Traversal via Filename / Storage Key | **HIGH** | Fully Mitigated | `src/lib/storage/storage-service.ts` | `tests/upload.test.ts` |
| **THR-15** | Denial of Service via Oversized Payloads | **MEDIUM** | Fully Mitigated | `src/lib/validation/upload-validator.ts` | `tests/upload.test.ts` |
| **THR-16** | Search-Result Information Leakage / Discovery Bypass | **HIGH** | Fully Mitigated | `src/app/api/documents/route.ts` | `tests/authorization.test.ts` |
| **THR-17** | SQL Injection Attack Vectors | **CRITICAL** | Fully Mitigated | Prisma ORM Parameterized Engine | Architecture Standard |
| **THR-18** | Cross-Site Request Forgery (CSRF) | **HIGH** | Fully Mitigated | `src/lib/auth/session.ts` | Cookie Architecture |
| **THR-19** | Cross-Site Scripting (XSS) & Content Sniffing | **HIGH** | Fully Mitigated | `next.config.js`, `src/lib/api-response.ts` | HTTP Headers Config |
| **THR-20** | Temporary Signed URL Leakage | **MEDIUM** | Fully Mitigated | Architecture Decision (Authenticated Proxy) | `src/app/api/documents/[id]/download/route.ts` |
| **THR-21** | Race Conditions during Concurrent Permission Updates | **MEDIUM** | Fully Mitigated | `src/app/api/documents/[id]/permissions/route.ts` | Atomic Upsert |
| **THR-22** | Fail-Open Permission Mutation on Audit Write Failure | **HIGH** | Fully Mitigated | `src/lib/audit/audit-service.ts` | `tests/audit.test.ts` |

---

## Detailed Threat Specifications

### THR-01: Insecure Direct Object Reference (IDOR) on Document Read
- **Attack Scenario**: Attacker authenticates as Viewer B, observes valid UUIDs of Owner A's confidential documents, and queries `GET /api/documents/:id` hoping the backend checks only that the ID exists.
- **Attacker Capability**: Authenticated non-privileged user with network access to API.
- **Affected Assets**: Confidential documents owned by other organizations/users.
- **Severity**: **CRITICAL**
- **Implemented Mitigation**:
  Centralized authorization function `requireDocumentReadAccess` verifies that the current user is either the explicit owner (`ownerId === user.id`) or holds an active grant in `DocumentPermission`. If unauthorized, the server responds with a uniform `404 Not Found`, completely preventing document enumeration.
- **Relevant Code Location**: `src/lib/auth/authorization.ts` (lines 118–180)
- **Relevant Automated Test**: `tests/authorization.test.ts` (`denies Owner B from reading Owner A unshared document`)
- **Residual Risk**: Low. Relies on database integrity.
- **Status**: **Mitigated**.

---

### THR-02: Insecure Direct Downloads & Guessable Storage Keys
- **Attack Scenario**: Attacker directly requests file payloads hoping that knowing or guessing an internal filename/path bypasses the application router.
- **Attacker Capability**: Anonymous or authenticated attacker attempting path exploration.
- **Affected Assets**: Raw file bytes in private storage.
- **Severity**: **CRITICAL**
- **Implemented Mitigation**:
  Files are never stored under publicly served directories (e.g. `/public`). Internal storage keys are opaque random UUIDs completely unrelated to user filenames. File retrieval occurs exclusively through the server proxy (`/api/documents/:id/download`), which enforces `requireDocumentDownloadAccess` before reading file bytes. Denied access streams zero bytes.
- **Relevant Code Location**: `src/app/api/documents/[id]/download/route.ts` (lines 13–64)
- **Relevant Automated Test**: `tests/authorization.test.ts` (`enforces immediate revocation`)
- **Residual Risk**: None for application routes.
- **Status**: **Mitigated**.

---

### THR-03 & THR-04: Privilege Escalation & Administrator Confidentiality Bypass
- **Attack Scenario**: A system administrator attempts to download or view confidential executive files without an explicit grant, or an attacker tampers with client role headers to access administrative routes.
- **Attacker Capability**: Rogue administrator or authenticated user attempting role tampering.
- **Affected Assets**: Administrative governance console, confidential files.
- **Severity**: **HIGH**
- **Implemented Mitigation**:
  All roles are loaded directly from the database session on the server. Client-provided role headers are never trusted. Administrators are granted access to metadata, user management, and audit verification, but **have no automatic read or download bypass** on confidential document payloads.
- **Relevant Code Location**: `src/lib/auth/authorization.ts` (lines 100–115, 145–175)
- **Relevant Automated Test**: `tests/admin.test.ts` (`PREVENTS ADMINISTRATORS FROM DOWNLOADING CONFIDENTIAL DOCUMENT PAYLOADS`)
- **Residual Risk**: A database administrator with direct physical root SQL access could alter records directly.
- **Status**: **Mitigated at Application Layer**.

---

### THR-05: Stale Permissions & Delayed Revocation Exploitation
- **Attack Scenario**: An owner revokes a contractor's access, but the contractor continues downloading documents using cached authorization tokens or open browser sessions.
- **Attacker Capability**: Revoked user attempting subsequent file access.
- **Affected Assets**: Document confidentiality after termination.
- **Severity**: **HIGH**
- **Implemented Mitigation**:
  Permissions are evaluated live against the database on every single request. Deleting a permission record immediately and atomically denies all subsequent requests with zero cache grace period.
- **Relevant Code Location**: `src/app/api/documents/[id]/permissions/[permissionId]/route.ts` (lines 40–55)
- **Relevant Automated Test**: `tests/authorization.test.ts` (`enforces immediate revocation: revoked viewer is denied on the very next request`)
- **Residual Risk**: Document files already saved locally to the user's hard drive prior to revocation cannot be remotely deleted.
- **Status**: **Mitigated**.

---

### THR-06: Session Hijacking & Account Deactivation Bypass
- **Attack Scenario**: A terminated employee whose account has been disabled attempts to make requests using a previously issued session cookie.
- **Attacker Capability**: Former employee holding valid session cookie.
- **Affected Assets**: Full platform access.
- **Severity**: **HIGH**
- **Implemented Mitigation**:
  `validateSessionToken` checks `session.revoked === false` and `user.isActive === true` on every request. When an administrator deactivates an account via `PATCH /api/admin/users/:id`, `revokeAllUserSessions` immediately invalidates all active sessions for that user ID in the database.
- **Relevant Code Location**: `src/lib/auth/session.ts` (lines 75–110), `src/app/api/admin/users/[id]/route.ts` (lines 45–55)
- **Relevant Automated Test**: `tests/auth.test.ts` (`denies session validation for deactivated user accounts`)
- **Residual Risk**: Low.
- **Status**: **Mitigated**.

---

### THR-07: Password Attacks (Brute-Force & Rainbow Tables)
- **Attack Scenario**: Attacker runs automated password dictionary attacks against organizational accounts or recovers password hashes from database backups.
- **Attacker Capability**: Remote attacker or possessor of offline database dump.
- **Affected Assets**: User credentials and accounts.
- **Severity**: **HIGH**
- **Implemented Mitigation**:
  Passwords are hashed with **Argon2id** (memory cost: 64MB, time cost: 3 iterations, parallelism: 4 threads), providing superior ASIC/GPU resistance. The login endpoint tracks consecutive failed attempts and locks accounts for 15 minutes after 5 failures. Generic error messages prevent account enumeration.
- **Relevant Code Location**: `src/lib/auth/password.ts`, `src/app/api/auth/login/route.ts` (lines 35–65)
- **Relevant Automated Test**: `tests/auth.test.ts` (`rejects invalid passwords against Argon2id hash`)
- **Residual Risk**: Weak user-chosen passwords vulnerable to targeted guessing before lockout.
- **Status**: **Mitigated**.

---

### THR-08 & THR-09: Tampering or Deleting Records in Audit Logs
- **Attack Scenario**: A malicious insider modifies or deletes audit records in the database to conceal unauthorized file access.
- **Attacker Capability**: Insider with database write privileges.
- **Affected Assets**: Audit integrity and forensic compliance.
- **Severity**: **CRITICAL**
- **Implemented Mitigation**:
  Audit logs are cryptographically linked in a sequential SHA-256 hash chain:
  $$H_n = \text{SHA-256}(Sequence \mathbin{\Vert} Timestamp \mathbin{\Vert} Actor \mathbin{\Vert} Action \mathbin{\Vert} Target \mathbin{\Vert} Outcome \mathbin{\Vert} PrevHash \mathbin{\Vert} Metadata)$$
  Any altered event breaks $H_n \ne \text{recalculated}$, and any deleted event breaks $PrevHash_{n+1} \ne CurrentHash_{n-1}$ or creates a sequence gap. `verifyAuditChain()` detects any alteration.
- **Relevant Code Location**: `src/lib/audit/audit-service.ts` (lines 65–190, 205–290)
- **Relevant Automated Test**: `tests/audit.test.ts` (`detects tampering when an audit event payload is modified in the database`, `detects tampering when an event is deleted from the middle of the chain`)
- **Residual Risk**: A privileged attacker who has full database control and recalculates the entire chain from the modified block forward could rewrite history unless the chain head is periodically anchored externally.
- **Status**: **Mitigated with Database Hash Chain (External Anchoring Documented)**.

---

### THR-13: MIME-Type Spoofing & Polyglot Uploads
- **Attack Scenario**: Attacker renames a malicious executable or script to `invoice.pdf` with `Content-Type: application/pdf` and uploads it.
- **Attacker Capability**: Authenticated user uploading malicious payloads.
- **Affected Assets**: Server filesystem and downstream viewers.
- **Severity**: **HIGH**
- **Implemented Mitigation**:
  The server inspects raw magic numbers (file signatures) of the uploaded buffer. Disallowed extensions, mismatched magic bytes (e.g. non-PDF bytes claimed as PDF), and files without valid signatures are rejected. Uploaded files are stored with random UUID keys and never executed.
- **Relevant Code Location**: `src/lib/validation/upload-validator.ts` (lines 20–75)
- **Relevant Automated Test**: `tests/upload.test.ts` (`detects and rejects MIME type spoofing`)
- **Residual Risk**: Zero-day vulnerabilities inside PDF viewer parsers. An antivirus integration point (e.g. ClamAV daemon) is documented for enterprise deployment.
- **Status**: **Mitigated**.

---

### THR-14: Path Traversal via Filename or Storage Keys
- **Attack Scenario**: Attacker provides filenames like `../../../../etc/shadow` or attempts to download `..\\..\\windows\\system32\\cmd.exe`.
- **Attacker Capability**: Remote attacker manipulating request parameters.
- **Affected Assets**: Host filesystem and OS binaries.
- **Severity**: **HIGH**
- **Implemented Mitigation**:
  1. `sanitizeFilename` strips all path separators, null bytes, and non-alphanumeric characters.
  2. `sanitizeAndResolvePath` enforces a strict UUID regex for all storage keys and verifies that `path.resolve` strictly resides within `LOCAL_STORAGE_DIR`. Throws `PathTraversalError` on violation.
- **Relevant Code Location**: `src/lib/storage/storage-service.ts` (lines 25–45), `src/lib/validation/upload-validator.ts` (lines 80–100)
- **Relevant Automated Test**: `tests/upload.test.ts` (`sanitizes dangerous filenames preventing path traversal attacks`)
- **Residual Risk**: None.
- **Status**: **Mitigated**.

---

### THR-22: Fail-Open State on Audit Write Failure
- **Attack Scenario**: An attacker induces an error in the audit service (e.g. database table lock or corruption) while granting themselves access, hoping the permission grant persists while the audit record fails silently.
- **Attacker Capability**: Attacker attempting race or fault-injection attacks.
- **Affected Assets**: Audit accountability.
- **Severity**: **HIGH**
- **Implemented Mitigation**:
  All critical mutations (`PERMISSION_GRANT`, `PERMISSION_REVOKE`, `DOCUMENT_DELETE`, `USER_STATUS_CHANGE`) enforce a **fail-closed policy** via `failClosed: true`. If the audit event cannot be written to the database hash chain, `AuditPersistenceError` is thrown and the calling transaction aborts immediately.
- **Relevant Code Location**: `src/lib/audit/audit-service.ts` (lines 100–120, 180–190)
- **Relevant Automated Test**: `tests/audit.test.ts`
- **Residual Risk**: None.
- **Status**: **Mitigated**.
