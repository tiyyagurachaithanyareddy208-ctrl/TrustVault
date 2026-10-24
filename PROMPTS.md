# TrustVault: AI Development & Security Engineering Log (PROMPTS.md)

This living development log records architectural prompts, generated solutions, identified security weaknesses or edge-case assumptions, engineering corrections, verified commit references, and automated tests.

---

### Entry 1: 2026-10-24 — Foundation, Dependency Isolation, and Native Cryptographic Tooling
- **Task / Prompt Given to AI**:
  Configure the runtime stack for TrustVault (Next.js 14, TypeScript, Tailwind CSS, Prisma ORM, Argon2id, and Vitest), ensuring full operational compatibility in a security-restricted environment without relying on external cloud dependencies for basic local execution.
- **Generated Solution**:
  Configured `package.json` with Next.js 14.2.15, Prisma 5.22, Vitest, and Argon2id. Installed isolated toolchain wrappers for Node.js, npm, and Git.
- **Specific Errors, Weaknesses, or Assumptions Found**:
  1. *Assumption*: Assumed `npx` and global PATH variables would seamlessly execute binaries spawned across isolated non-interactive PowerShell child sessions without explicit path resolution.
  2. *Security finding*: Relying on default package manager lifecycle scripts during installation can execute unverified native build scripts; Node-API prebuilds for Argon2id and Prisma Query Engine must be verified directly against the host architecture.
- **How Corrected**:
  Updated npm execution scripts in `package.json` to directly bind to local `node_modules` entry points (`node node_modules/...`), avoiding shell lookup vulnerabilities. Verified native binary execution of `argon2.hash()` and Prisma's `libquery-engine` on Windows x64.
- **Real Git Commit Reference**:
  `4c98190`
- **Verification**:
  Executed `argon2.hash()` generating valid `$argon2id$v=19$m=65536...` hashes; validated Prisma CLI and Vitest CLI execution.

---

### Entry 2: 2026-10-24 — Cryptographic Hash-Chained Audit Trail & Foreign Key Actor Desynchronization
- **Task / Prompt Given to AI**:
  Implement the tamper-evident audit logging service (`recordAuditEvent`, `computeBlockHash`, `verifyAuditChain`) maintaining a strictly monotonic SHA-256 hash chain with database concurrency control and fail-closed persistence on critical operations.
- **Generated Solution**:
  Built `src/lib/audit/audit-service.ts` with serialized transactions over `AuditChainHead`, calculating $H_n = \text{SHA-256}(Payload_n \mathbin{\Vert} H_{n-1})$. Implemented `verifyAuditChain()` to recompute every block's cryptographic hash.
- **Specific Errors, Weaknesses, or Assumptions Found**:
  1. *Foreign Key Violation*: The initial implementation attempted to directly write untrusted `payload.actorId` into `AuditEvent.actorId`. When recording security telemetry for unauthenticated actors (e.g. failed login attempts with non-existent user IDs), the database foreign key constraint threw a constraint violation.
  2. *Canonical Hash Desynchronization*: In attempting to fix the foreign key violation by setting `actorId: resolvedActorId` (null), `computeBlockHash` had computed the hash using the original unpersisted `payload.actorId`, whereas `verifyAuditChain` recomputed it using `ev.actorId || 'SYSTEM_ANONYMOUS'`, causing verification to fail on unauthenticated events.
- **How Corrected**:
  Updated `recordAuditEvent` to resolve `resolvedActorId` prior to computing the block hash. Standardized canonical serialization across both writer and verifier to strictly use `resolvedActorId || payload.actorEmail || 'SYSTEM_ANONYMOUS'`.
- **Real Git Commit Reference**:
  `46fde56`
- **Verification**:
  Executed `tests/audit.test.ts` verifying 100% chain validity, payload tampering detection, intermediate event deletion detection, and sequence gap detection.

---

### Entry 3: 2026-10-24 — Deny-by-Default Server Authorization & Insecure Direct Object Reference Defense
- **Task / Prompt Given to AI**:
  Implement centralized server-side authorization enforcement across all document routes (read, download, edit, delete, grant, revoke). Ensure that knowing a document ID, URL, filename, or storage key never grants unauthorized access, and that administrators have no automatic read/download bypass.
- **Generated Solution**:
  Developed `src/lib/auth/authorization.ts` enforcing `requireAuthenticatedUser`, `requireDocumentReadAccess`, `requireDocumentDownloadAccess`, and `requireDocumentOwner`. Integrated uniform 404 response strategy for unpermitted resources to prevent resource enumeration.
- **Specific Errors, Weaknesses, or Assumptions Found**:
  1. *Resource Enumeration via 403 vs 404*: Initial designs often return 403 Forbidden for existing records, which immediately informs an attacker that a guessed UUID exists.
  2. *Administrative Bypass Vulnerability*: In conventional multi-tenant apps, admin roles often shortcut access rules. If an administrator is granted a silent document read bypass, confidential executive documents are exposed without owner consent.
  3. *Immediate Revocation Guarantee*: Cached permissions or persistent download tokens can allow access after an owner revokes a grant.
- **How Corrected**:
  Enforced strict 404 Not Found responses for inaccessible documents. Specifically validated that administrators cannot download or read unshared documents without explicit grants. Verified that deleting a permission grant from the database immediately blocks the next read/download request with zero grace period.
- **Real Git Commit Reference**:
  `68d067b`
- **Verification**:
  Executed 29 automated tests across `tests/authorization.test.ts`, `tests/admin.test.ts`, `tests/auth.test.ts`, `tests/upload.test.ts`, `tests/audit.test.ts`, and `tests/regression.test.ts` with 100% pass rate.

---
