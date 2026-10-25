# TrustVault

**Secure Document Sharing Platform with Verifiable Cryptographic Audit Trails**

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/tiyyagurachaithanyareddy208-ctrl/TrustVault)

TrustVault is an enterprise-grade, security-first document management and sharing platform built on zero-trust principles. It delivers strict server-side authorization, cryptographic tamper-evident audit trails, private storage isolation, and non-bypassable administrative boundaries.

---

## 1. Architecture Overview

```mermaid
flowchart TD
    subgraph Client ["Client Layer (Next.js Enterprise SaaS UI)"]
        UI["Modern Enterprise UI\n(Tailwind CSS, Lucide, React Hook Form)"]
        AuthCtx["Auth Context & Persona Switcher\n(Zero Client-Side Trust)"]
    end

    subgraph SecurityBoundary ["Server Security Boundary (Next.js 14 Route Handlers)"]
        AuthnGuard["Session & Rate Limit Guard\n(Argon2id KDF, Secure Cookies)"]
        AuthzEngine["Centralized Authorization Engine\n(requireAuthenticatedUser, requireDocumentReadAccess,\nrequireDocumentDownloadAccess, requireDocumentOwner, requireAdministrator)"]
        UploadValidator["Strict Upload Validator\n(Magic Bytes, MIME, Extension, Size)"]
        StorageAdapter["Private Storage Engine\n(Random UUID Storage Keys, Streaming Proxy)"]
        AuditService["Tamper-Evident Audit Trail\n(SHA-256 Hash Chain, Fail-Closed Mutations)"]
    end

    subgraph StorageLayer ["Isolated Persistence"]
        DB[("Database Engine\n(PostgreSQL / SQLite via Prisma ORM)")]
        VaultDisk[("Private Storage Vault\n(Outside Web Root, No Public URLs)")]
    end

    UI --> AuthnGuard
    AuthnGuard --> AuthzEngine
    AuthzEngine --> DB
    AuthzEngine --> UploadValidator
    UploadValidator --> StorageAdapter
    StorageAdapter --> VaultDisk
    AuthzEngine --> StorageAdapter
    AuthzEngine --> AuditService
    AuditService --> DB
```

---

## 2. Core Security Guarantees & Architectural Principles

1. **Deny-by-Default Authorization**: No frontend control, client-supplied role header, or opaque UUID is trusted. Every sensitive backend route handler independently queries the database and verifies active credentials before execution.
2. **True IDOR Defense via Uniform 404s**: Knowing or guessing a valid document UUID yields a consistent `404 Not Found` if the requesting user lacks an active grant, eliminating document enumeration vulnerabilities.
3. **Strict Separation of Administrative Duty**: Administrators govern accounts, review security telemetry, and verify the cryptographic audit chain. **Administrators cannot read or download confidential documents without an explicit, audited grant from the owner.**
4. **Immediate Revocation**: Document permission revocations execute atomically in the database. A revoked user's next request is denied with zero cache grace period.
5. **Private Storage Isolation**: File payloads are stored outside the public web root using randomized UUID storage keys. Files are streamed exclusively through authorized server proxies with safe HTTP headers (`Content-Disposition: attachment; filename="..."`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`).
6. **Verifiable Tamper-Evident Audit Logging**: Every sensitive action is linked in a sequential SHA-256 cryptographic hash chain:
   $$H_n = \text{SHA-256}(Sequence \mathbin{\Vert} Timestamp \mathbin{\Vert} Actor \mathbin{\Vert} Action \mathbin{\Vert} Target \mathbin{\Vert} Outcome \mathbin{\Vert} PrevHash \mathbin{\Vert} Metadata)$$
   Any payload alteration or block omission is immediately detected by the verification engine. Critical operations fail-closed if audit logging fails.

---

## 3. Role & Permission Matrix

| Capability | Administrator | Document Owner | Viewer (READ) | Viewer (EDIT) | Unauthenticated |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Access Admin Console | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage User Accounts & Status | ✅ | ❌ | ❌ | ❌ | ❌ |
| View System Security Events | ✅ | ❌ | ❌ | ❌ | ❌ |
| Verify Hash Chain Integrity | ✅ | ❌ | ❌ | ❌ | ❌ |
| Upload New Document | ✅* | ✅ | ❌ | ❌ | ❌ |
| View Owned Document & Metadata | ✅ (if owner) | ✅ | ❌ | ❌ | ❌ |
| Read / Download Shared Document | ❌ (no bypass) | ✅ | ✅ | ✅ | ❌ |
| Edit Document Metadata | ❌ | ✅ | ❌ | ✅ | ❌ |
| Grant / Revoke Permissions | ❌ | ✅ | ❌ | ❌ | ❌ |
| Delete Document | ❌ | ✅ | ❌ | ❌ | ❌ |
| View Audit Trail of Document | ❌ (no bypass) | ✅ | ❌ | ❌ | ❌ |

*\* Administrators may upload personal documents if granted owner capability, but administrative status conveys zero content read bypass.*

---

## 4. Technology Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Lucide icons, TanStack Table.
- **Backend**: Next.js Server Route Handlers, TypeScript, Prisma ORM.
- **Database**: PostgreSQL (Production & Docker Compose) / SQLite (Zero-friction local development & automated test execution).
- **Authentication & KDF**: Server-managed HTTP-Only session cookies with **Argon2id** password hashing (`m=65536, t=3, p=4`).
- **File Storage**: Private local storage adapter with path traversal elimination and S3 API compatibility abstraction.
- **Automated Testing**: Vitest test suite with 29 passing unit, cross-user authorization, IDOR, upload, and regression tests.

---

## 5. Local Demo Accounts & Seed Credentials

For evaluation and demonstration purposes, the database seed script pre-populates the following accounts:

| Role | Email | Password | Description |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@example.test` | `AdminSecretPass123!` | System administrator (governance & audit) |
| **Document Owner A** | `owner-a@example.test` | `OwnerASecretPass123!` | Owns Q3 Financial Report & Security Architecture |
| **Document Owner B** | `owner-b@example.test` | `OwnerBSecretPass123!` | Owns Product Roadmap & HR Compensation Policy |
| **Viewer A** | `viewer-a@example.test` | `ViewerASecretPass123!` | Holds READ grant on Q3 Financial & HR Policy |
| **Viewer B** | `viewer-b@example.test` | `ViewerBSecretPass123!` | Holds EDIT grant on Corporate Bylaws |

> [!NOTE]
> The login interface provides **1-click demo persona quick-fill buttons**, allowing security evaluators to switch between Administrator, Owners, and Viewers in seconds.

---

## 6. Installation & Quickstart

### Prerequisites
- Node.js 18+ (tested on Node 20 and 24 LTS)
- npm or pnpm

### Quickstart Commands
```bash
# 1. Clone the repository
git clone <repository-url>
cd TrustVault

# 2. Install dependencies
npm install

# 3. Initialize database schema
npm run prisma:push

# 4. Seed database with synthetic personas, documents, and audit chain
npm run seed

# 5. Run automated security tests
npm run test

# 6. Start the development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## 7. Automated Security Test Suite

The automated test suite runs real HTTP requests and database mutations verifying cross-user isolation and tamper evidence:

```bash
npm run test
```

### Verified Test Results
```
 ✓ tests/upload.test.ts         (6 tests) - Magic bytes, MIME spoofing rejection, path traversal prevention
 ✓ tests/admin.test.ts          (4 tests) - Admin controls, strictly prevents automatic download bypass
 ✓ tests/audit.test.ts          (4 tests) - Monotonic sequence, payload tamper detection, block omission detection
 ✓ tests/authorization.test.ts  (8 tests) - IDOR defense, owner isolation, immediate permission revocation
 ✓ tests/regression.test.ts     (2 tests) - Proves that removing an authorization check fails security tests
 ✓ tests/auth.test.ts           (5 tests) - Argon2id verification, session lifecycle, inactive account rejection

Test Files  6 passed (6)
     Tests  29 passed (29)
```

---

## 8. Production Deployment Configuration

### Option A: Docker Compose (PostgreSQL 16 + Web App)
A production-ready `docker-compose.yml` and multi-stage `Dockerfile` are included:

```bash
# Build and launch PostgreSQL and TrustVault containers
docker compose up -d --build

# Run database migrations and seed inside the container
docker compose exec web npm run prisma:push
docker compose exec web npm run seed
```

### Option B: Standalone Production Build
```bash
# Configure production environment variables in .env
DATABASE_URL="postgresql://user:password@host:5432/trustvault?schema=public"
SESSION_SECRET="<generate-minimum-64-character-hex-secret>"
NODE_ENV="production"

# Generate Prisma client and compile optimized production build
npm run prisma:generate
npm run build

# Start production server
npm run start
```

---

## 9. Key Documentation Links

- **Threat Model**: [`THREATS.md`](./THREATS.md) — 22+ detailed attack scenarios, severity ratings, mitigations, code references, and residual risk assessments.
- **API Documentation**: [`API.md`](./API.md) — REST API endpoint specifications, permission matrix, request/response samples, and fail-closed policies.
- **AI Development Log**: [`PROMPTS.md`](./PROMPTS.md) — Living development log documenting prompt iterations, discovered vulnerabilities, code corrections, and real Git commit references.

---

## 10. Security Assumptions & Known Limitations

1. **Database Hash Chain Trust Boundary**: A database-resident hash chain guarantees detection of unauthorized modification or record deletion by application users or unprivileged database connections. However, an attacker with full root SQL database control who recalculates all subsequent hashes could rewrite history unless the chain head is periodically anchored externally (e.g. independently controlled immutable S3 bucket or external timestamping authority).
2. **File Signature Validation**: Magic-byte verification detects MIME spoofing (e.g. executables renamed to `.pdf`). However, it does not replace an enterprise antivirus sandbox (such as ClamAV or VirusTotal API), which should be added to the upload pipeline in regulated environments.
3. **Local Private Storage Adapter**: The default storage adapter writes to `./storage/vault_files` outside the web root with restricted permissions (`0600`). For multi-server cloud deployments, configure an S3-compatible private object store.

---

## 11. Live URL & Active Demonstration

- **Live Public URL**: [https://bar-arlington-insider-vessels.trycloudflare.com](https://bar-arlington-insider-vessels.trycloudflare.com)
- **Local URL**: [http://localhost:3000](http://localhost:3000)
- **Status**: Live & Serving (Validated via automated HTTP checks)
- **Evaluation**: Click any of the 1-click demo persona quick-fill buttons on the login screen to test Administrator, Owner A, Owner B, Viewer A, and Viewer B.
