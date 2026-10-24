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
