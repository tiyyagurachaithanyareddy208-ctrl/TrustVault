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
