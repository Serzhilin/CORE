# CORE Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the fully working CORE API — Express + TypeORM + PostgreSQL — with W3DS ePassport auth, all community/member/workgroup/role routes, and availability state machine. W3DS eVault sync is stubbed (Phase 2).

**Architecture:** Single Express app with TypeORM entities. Auth copies ALVer's ePassport pattern verbatim (same signature-validator + JWT). Business logic lives in service files; controllers are thin. The availability state machine is extracted as a pure function so it can be unit-tested without a DB.

**Tech Stack:** Node.js 20, Express 4, TypeORM 0.3, PostgreSQL 16, TypeScript 5, Jest + supertest (tests)

**Ports:** API → 3002, DB → 5434

---

## File Map

| File | Purpose |
|---|---|
| `CORE/package.json` | Root: dev script (concurrently), db:up/down |
| `CORE/docker-compose.yml` | postgres:5434 dev container |
| `CORE/.env` | Dev env vars |
| `api/package.json` | API deps + scripts |
| `api/tsconfig.json` | TS config (decorators enabled) |
| `api/jest.config.js` | Jest with ts-jest |
| `api/vendor/web3-adapter/` | Copy from ALVer (W3DS auth) |
| `api/src/lib/logger.ts` | Pino logger |
| `api/src/lib/signature-validator.ts` | Copy from ALVer |
| `api/src/database/data-source.ts` | TypeORM DataSource |
| `api/src/database/entities/Person.ts` | Person entity |
| `api/src/database/entities/Community.ts` | Community entity |
| `api/src/database/entities/CommunityMembership.ts` | Membership entity |
| `api/src/database/entities/AvailabilityType.ts` | Absence type entity |
| `api/src/database/entities/AvailabilityLog.ts` | Immutable absence history |
| `api/src/database/entities/Workgroup.ts` | Workgroup entity |
| `api/src/database/entities/Role.ts` | Role entity |
| `api/src/database/entities/WorkgroupMembership.ts` | Person ↔ Workgroup link |
| `api/src/database/entities/WorkgroupMemberRole.ts` | Role assignment |
| `api/src/middleware/auth.ts` | JWT sign/verify + requireAuth |
| `api/src/middleware/communityAccess.ts` | Verify caller is member of :cid |
| `api/src/services/PersonService.ts` | findOrCreate, fetchEVaultProfile |
| `api/src/services/AvailabilityService.ts` | Pure state machine + DB writes |
| `api/src/services/CommunityService.ts` | Community CRUD |
| `api/src/services/MemberService.ts` | Member CRUD |
| `api/src/services/AvailabilityTypeService.ts` | AvailabilityType CRUD |
| `api/src/services/WorkgroupService.ts` | Workgroup + role + membership CRUD |
| `api/src/controllers/AuthController.ts` | ePassport login, SSE, /me |
| `api/src/controllers/CommunityController.ts` | Community routes |
| `api/src/controllers/MemberController.ts` | Member + availability routes |
| `api/src/controllers/AvailabilityTypeController.ts` | Availability type routes |
| `api/src/controllers/WorkgroupController.ts` | Workgroup + role + wg-member routes |
| `api/src/web3adapter/subscriber.ts` | No-op stub |
| `api/src/web3adapter/mappings/community.mapping.json` | Empty stub |
| `api/src/web3adapter/mappings/person.mapping.json` | Empty stub |
| `api/src/index.ts` | Express server, all routes wired |

---

## Task 1: Root Scaffold

**Files:**
- Create: `CORE/package.json`
- Create: `CORE/docker-compose.yml`
- Create: `CORE/.env`

- [ ] **Step 1: Create `CORE/package.json`**

```json
{
  "name": "core",
  "private": true,
  "scripts": {
    "dev": "concurrently -n api,client -c cyan,magenta \"npm run dev --prefix api\" \"npm run dev --prefix app\"",
    "db:up": "docker compose up -d postgres",
    "db:down": "docker compose down",
    "db:seed": "npm run seed --prefix api"
  },
  "devDependencies": {
    "concurrently": "^9.1.2"
  }
}
```

- [ ] **Step 2: Create `CORE/docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: core-postgres
    environment:
      POSTGRES_USER: core
      POSTGRES_PASSWORD: core
      POSTGRES_DB: core
    ports:
      - "5434:5432"
    volumes:
      - core-postgres-data:/var/lib/postgresql/data

volumes:
  core-postgres-data:
```

- [ ] **Step 3: Create `CORE/.env`**

```env
NODE_ENV=development
PORT=3002
DB_HOST=localhost
DB_PORT=5434
DB_USER=core
DB_PASSWORD=core
DB_NAME=core
JWT_SECRET=core-dev-secret
PUBLIC_REGISTRY_URL=https://registry.w3ds.metastate.foundation
VITE_PUBLIC_CORE_BASE_URL=http://localhost:3002
USE_LOCAL_W3DS=true
```

- [ ] **Step 4: Install root dev dep and start DB**

```bash
cd /home/serzhilin/Projects/CORE
npm install
npm run db:up
```

Expected: postgres container starts on port 5434.

- [ ] **Step 5: Commit**

```bash
git init
git add package.json docker-compose.yml .env
git commit -m "chore: root scaffold — docker-compose postgres:5434"
```

---

## Task 2: API Scaffold + Dependencies

**Files:**
- Create: `api/package.json`
- Create: `api/tsconfig.json`
- Create: `api/jest.config.js`
- Create: `api/src/lib/logger.ts`
- Copy: `api/vendor/web3-adapter/` from ALVer
- Copy: `api/src/lib/signature-validator.ts` from ALVer

- [ ] **Step 1: Create `api/package.json`**

```json
{
  "name": "core-api",
  "version": "1.0.0",
  "main": "src/index.ts",
  "scripts": {
    "dev": "nodemon --exec \"npx ts-node\" src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest --runInBand",
    "typeorm": "typeorm-ts-node-commonjs"
  },
  "dependencies": {
    "@types/jsonwebtoken": "^9.0.10",
    "axios": "^1.6.7",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.18.2",
    "express-rate-limit": "^8.3.1",
    "jose": "^5.2.0",
    "jsonwebtoken": "^9.0.3",
    "multiformats": "13.3.2",
    "pg": "^8.11.3",
    "pino": "^10.3.1",
    "pino-http": "^11.0.0",
    "reflect-metadata": "^0.2.1",
    "typeorm": "^0.3.24",
    "uuid": "^9.0.1",
    "web3-adapter": "file:./vendor/web3-adapter"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.12",
    "@types/node": "^20.11.24",
    "@types/pg": "^8.11.2",
    "@types/supertest": "^6.0.2",
    "@types/uuid": "^9.0.8",
    "jest": "^29.7.0",
    "nodemon": "^3.0.3",
    "pino-pretty": "^13.1.3",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.5",
    "ts-node": "^10.9.2",
    "typescript": "^5.3.3"
  }
}
```

- [ ] **Step 2: Create `api/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create `api/jest.config.js`**

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
};
```

- [ ] **Step 4: Copy vendor and lib from ALVer**

```bash
cp -r /home/serzhilin/Projects/ALVer/api/vendor /home/serzhilin/Projects/CORE/api/vendor
mkdir -p /home/serzhilin/Projects/CORE/api/src/lib
cp /home/serzhilin/Projects/ALVer/api/src/lib/signature-validator.ts \
   /home/serzhilin/Projects/CORE/api/src/lib/signature-validator.ts
```

- [ ] **Step 5: Create `api/src/lib/logger.ts`**

```typescript
import pino from "pino";

export const logger = pino({
    level: process.env.LOG_LEVEL || "info",
    ...(process.env.NODE_ENV !== "production" && {
        transport: { target: "pino-pretty", options: { colorize: true, ignore: "pid,hostname" } },
    }),
});
```

- [ ] **Step 6: Create skeleton `api/src/index.ts`**

```typescript
import "reflect-metadata";
import path from "path";
import cors from "cors";
import { config } from "dotenv";
import express from "express";
import { logger } from "./lib/logger";
import { AppDataSource } from "./database/data-source";

config({ path: path.resolve(__dirname, "../../.env") });

const app = express();
const port = process.env.PORT || 3002;

app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] }));
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (_, res) =>
    res.json({ status: "ok", db: AppDataSource.isInitialized ? "connected" : "disconnected" })
);

AppDataSource.initialize()
    .then(() => {
        app.listen(port, () => logger.info(`CORE API running on :${port}`));
    })
    .catch((err) => {
        logger.error(err, "DB init failed");
        process.exit(1);
    });

export { app };
```

- [ ] **Step 7: Install deps**

```bash
cd /home/serzhilin/Projects/CORE/api
npm install
```

- [ ] **Step 8: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add api/
git commit -m "chore: api scaffold — express skeleton, jest, copied vendor+lib"
```

---

## Task 3: Database Entities + DataSource

**Files:**
- Create: `api/src/database/data-source.ts`
- Create: `api/src/database/entities/Person.ts`
- Create: `api/src/database/entities/Community.ts`
- Create: `api/src/database/entities/CommunityMembership.ts`
- Create: `api/src/database/entities/AvailabilityType.ts`
- Create: `api/src/database/entities/AvailabilityLog.ts`
- Create: `api/src/database/entities/Workgroup.ts`
- Create: `api/src/database/entities/Role.ts`
- Create: `api/src/database/entities/WorkgroupMembership.ts`
- Create: `api/src/database/entities/WorkgroupMemberRole.ts`
- Create: `api/src/web3adapter/subscriber.ts` (stub needed by data-source)

- [ ] **Step 1: Create stub subscriber (needed by data-source import)**

Create `api/src/web3adapter/subscriber.ts`:

```typescript
import { DataSource, EntitySubscriberInterface, EventSubscriber } from "typeorm";

@EventSubscriber()
export class CoreSubscriber implements EntitySubscriberInterface {
    // Phase 2: eVault sync will be wired here
}
```

- [ ] **Step 2: Create `api/src/database/entities/Person.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity("persons")
export class Person {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "varchar", nullable: true, unique: true })
    ename: string | null;

    @Column({ type: "varchar", nullable: true })
    first_name: string | null;

    @Column({ type: "varchar", nullable: true })
    last_name: string | null;

    @Column({ type: "varchar", nullable: true })
    email: string | null;

    @Column({ type: "varchar", nullable: true })
    phone: string | null;

    @Column({ type: "text", nullable: true })
    bio: string | null;

    @Column({ type: "text", nullable: true })
    avatar_url: string | null;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
```

- [ ] **Step 3: Create `api/src/database/entities/Community.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity("communities")
export class Community {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column()
    name: string;

    @Column({ unique: true })
    slug: string;

    @Column({ type: "text", nullable: true })
    description: string | null;

    @Column({ type: "text", nullable: true })
    logo_url: string | null;

    @Column({ default: "#C4622D" })
    primary_color: string;

    @Column({ default: "Playfair Display" })
    title_font: string;

    @Column({ type: "varchar", nullable: true })
    ename: string | null;

    @Column({ type: "text", nullable: true })
    evault_uri: string | null;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
```

- [ ] **Step 4: Create `api/src/database/entities/AvailabilityType.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity("availability_types")
export class AvailabilityType {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column()
    community_id: string;

    @Column()
    name: string;

    @Column()
    emoji: string;

    @Column({ type: "integer", default: 0 })
    sort_order: number;

    @Column({ default: false })
    is_archived: boolean;

    @CreateDateColumn()
    created_at: Date;
}
```

- [ ] **Step 5: Create `api/src/database/entities/CommunityMembership.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Unique } from "typeorm";

@Entity("community_memberships")
@Unique(["person_id", "community_id"])
export class CommunityMembership {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column()
    person_id: string;

    @Column()
    community_id: string;

    @Column({ default: false })
    is_admin: boolean;

    @Column({ default: false })
    is_aspirant: boolean;

    @Column({ type: "date", nullable: true })
    joined_at: Date | null;

    @Column({ type: "uuid", nullable: true })
    availability_type_id: string | null;

    @Column({ type: "text", nullable: true })
    availability_reason: string | null;

    @Column({ type: "date", nullable: true })
    availability_from: Date | null;

    @Column({ type: "date", nullable: true })
    availability_until: Date | null;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
```

- [ ] **Step 6: Create `api/src/database/entities/AvailabilityLog.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity("availability_logs")
export class AvailabilityLog {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column()
    community_membership_id: string;

    @Column()
    type_name: string;

    @Column()
    type_emoji: string;

    @Column({ type: "text", nullable: true })
    reason: string | null;

    @Column({ type: "date" })
    from_date: Date;

    @Column({ type: "date" })
    until_date: Date;

    @CreateDateColumn()
    created_at: Date;
}
```

- [ ] **Step 7: Create `api/src/database/entities/Workgroup.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity("workgroups")
export class Workgroup {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column()
    community_id: string;

    @Column()
    name: string;

    @Column({ type: "text", nullable: true })
    description: string | null;

    @Column({ default: "#C4622D" })
    color: string;

    @Column({ type: "integer", default: 0 })
    sort_order: number;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
```

- [ ] **Step 8: Create `api/src/database/entities/Role.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity("roles")
export class Role {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column()
    workgroup_id: string;

    @Column()
    name: string;

    @Column({ type: "text", nullable: true })
    description: string | null;

    @Column({ default: "#C4622D" })
    color: string;

    @Column({ type: "integer", default: 0 })
    sort_order: number;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
```

- [ ] **Step 9: Create `api/src/database/entities/WorkgroupMembership.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique } from "typeorm";

@Entity("workgroup_memberships")
@Unique(["person_id", "workgroup_id"])
export class WorkgroupMembership {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column()
    person_id: string;

    @Column()
    workgroup_id: string;

    @Column({ default: false })
    is_workgroup_admin: boolean;

    @CreateDateColumn()
    created_at: Date;
}
```

- [ ] **Step 10: Create `api/src/database/entities/WorkgroupMemberRole.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique } from "typeorm";

@Entity("workgroup_member_roles")
@Unique(["workgroup_membership_id", "role_id"])
export class WorkgroupMemberRole {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column()
    workgroup_membership_id: string;

    @Column()
    role_id: string;

    @CreateDateColumn()
    created_at: Date;
}
```

- [ ] **Step 11: Create `api/src/database/data-source.ts`**

```typescript
import "reflect-metadata";
import path from "path";
import { config } from "dotenv";
import { DataSource } from "typeorm";
import { Person } from "./entities/Person";
import { Community } from "./entities/Community";
import { CommunityMembership } from "./entities/CommunityMembership";
import { AvailabilityType } from "./entities/AvailabilityType";
import { AvailabilityLog } from "./entities/AvailabilityLog";
import { Workgroup } from "./entities/Workgroup";
import { Role } from "./entities/Role";
import { WorkgroupMembership } from "./entities/WorkgroupMembership";
import { WorkgroupMemberRole } from "./entities/WorkgroupMemberRole";
import { CoreSubscriber } from "../web3adapter/subscriber";

config({ path: path.resolve(__dirname, "../../../.env") });

const isProduction = process.env.NODE_ENV === "production";

export const AppDataSource = new DataSource({
    type: "postgres",
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5434"),
    username: process.env.DB_USER || "core",
    password: process.env.DB_PASSWORD || "core",
    database: process.env.DB_NAME || "core",
    synchronize: !isProduction,
    entities: [
        Person, Community, CommunityMembership,
        AvailabilityType, AvailabilityLog,
        Workgroup, Role, WorkgroupMembership, WorkgroupMemberRole,
    ],
    subscribers: [CoreSubscriber],
    logging: false,
});
```

- [ ] **Step 12: Verify TypeScript compiles**

```bash
cd /home/serzhilin/Projects/CORE/api
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 13: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add api/src/database/ api/src/web3adapter/subscriber.ts
git commit -m "feat: add all 9 TypeORM entities and data-source"
```

---

## Task 4: Auth Middleware + PersonService + AuthController

**Files:**
- Create: `api/src/middleware/auth.ts`
- Create: `api/src/middleware/communityAccess.ts`
- Create: `api/src/services/PersonService.ts`
- Create: `api/src/controllers/AuthController.ts`
- Modify: `api/src/index.ts` (add auth routes)

- [ ] **Step 1: Create `api/src/middleware/auth.ts`**

```typescript
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthPayload {
    userId: string;
    ename: string;
}

declare global {
    namespace Express {
        interface Request {
            user?: AuthPayload;
        }
    }
}

function getSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        if (process.env.NODE_ENV === "production") throw new Error("JWT_SECRET required");
        return "core-dev-secret";
    }
    return secret;
}

export function signToken(payload: AuthPayload): string {
    return jwt.sign(payload, getSecret(), { expiresIn: "30d" });
}

export function verifyToken(token: string): AuthPayload | null {
    try { return jwt.verify(token, getSecret()) as AuthPayload; }
    catch { return null; }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) { res.status(401).json({ error: "Authentication required" }); return; }
    const payload = verifyToken(header.slice(7));
    if (!payload) { res.status(401).json({ error: "Invalid or expired token" }); return; }
    req.user = payload;
    next();
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
    const header = req.headers.authorization;
    if (header?.startsWith("Bearer ")) {
        const payload = verifyToken(header.slice(7));
        if (payload) req.user = payload;
    }
    next();
}
```

- [ ] **Step 2: Create `api/src/middleware/communityAccess.ts`**

```typescript
import { Request, Response, NextFunction } from "express";
import { AppDataSource } from "../database/data-source";
import { CommunityMembership } from "../database/entities/CommunityMembership";

declare global {
    namespace Express {
        interface Request {
            membership?: CommunityMembership;
        }
    }
}

/** Requires req.user + :cid or :id param. Attaches req.membership. */
export function requireCommunityMember(req: Request, res: Response, next: NextFunction) {
    const communityId = req.params.cid || req.params.id;
    if (!req.user || !communityId) { res.status(403).json({ error: "Forbidden" }); return; }

    AppDataSource.getRepository(CommunityMembership)
        .findOne({ where: { person_id: req.user.userId, community_id: communityId } })
        .then((m) => {
            if (!m) { res.status(403).json({ error: "Not a member of this community" }); return; }
            req.membership = m;
            next();
        })
        .catch(() => res.status(500).json({ error: "Internal error" }));
}

export function requireCommunityAdmin(req: Request, res: Response, next: NextFunction) {
    requireCommunityMember(req, res, () => {
        if (!req.membership?.is_admin) { res.status(403).json({ error: "Admin access required" }); return; }
        next();
    });
}
```

- [ ] **Step 3: Create `api/src/services/PersonService.ts`**

```typescript
import { AppDataSource } from "../database/data-source";
import { Person } from "../database/entities/Person";

const repo = () => AppDataSource.getRepository(Person);

export async function findOrCreateByEname(ename: string): Promise<Person> {
    const existing = await repo().findOne({ where: { ename } });
    if (existing) return existing;
    return repo().save(repo().create({ ename }));
}

export async function findById(id: string): Promise<Person | null> {
    return repo().findOne({ where: { id } });
}

export async function updatePerson(id: string, data: Partial<Pick<Person,
    "first_name" | "last_name" | "email" | "phone" | "bio" | "avatar_url">>): Promise<Person> {
    const person = await repo().findOneOrFail({ where: { id } });
    Object.assign(person, data);
    return repo().save(person);
}

export function displayName(p: Person): string {
    if (p.first_name && p.last_name) return `${p.first_name} ${p.last_name}`;
    if (p.first_name) return p.first_name;
    return p.ename ?? p.id;
}

/** Fetch profile from eVault on first login. Returns null if unavailable. */
export async function fetchEVaultProfile(ename: string): Promise<{ first_name: string; last_name: string } | null> {
    const registryUrl = process.env.PUBLIC_REGISTRY_URL;
    const platformUrl = process.env.VITE_PUBLIC_CORE_BASE_URL;
    if (!registryUrl || !platformUrl) return null;
    try {
        const tokenRes = await fetch(`${registryUrl}/platforms/certification`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ platform: platformUrl }),
        });
        if (!tokenRes.ok) return null;
        const { token } = await tokenRes.json() as { token: string };

        const resolveRes = await fetch(`${registryUrl}/resolve?w3id=${encodeURIComponent(ename)}`);
        if (!resolveRes.ok) return null;
        const { uri } = await resolveRes.json() as { uri: string };

        const USER_SCHEMA_ID = "550e8400-e29b-41d4-a716-446655440000";
        const gqlRes = await fetch(new URL("/graphql", uri).toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "X-ENAME": ename },
            body: JSON.stringify({ query: `query { findMetaEnvelopesByOntology(ontology: "${USER_SCHEMA_ID}") { id parsed } }` }),
        });
        if (!gqlRes.ok) return null;
        const data = await gqlRes.json() as any;
        const envelopes: any[] = data?.data?.findMetaEnvelopesByOntology ?? [];
        if (!envelopes.length) return null;

        const merged: Record<string, any> = {};
        for (const env of envelopes) {
            for (const [k, v] of Object.entries(env.parsed ?? {})) {
                if (v !== null && v !== undefined && v !== "") merged[k] = v;
            }
        }
        const displayNameStr: string = merged.displayName ?? merged.name ?? "";
        const firstName: string = merged.firstName ?? displayNameStr.split(/\s+/)[0] ?? "";
        const lastName: string = merged.lastName ?? displayNameStr.split(/\s+/).slice(1).join(" ") ?? "";
        if (!firstName) return null;
        return { first_name: firstName, last_name: lastName };
    } catch {
        return null;
    }
}
```

- [ ] **Step 4: Create `api/src/controllers/AuthController.ts`**

```typescript
import { Request, Response } from "express";
import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import { verifySignature } from "../lib/signature-validator";
import { findOrCreateByEname, fetchEVaultProfile, updatePerson, displayName } from "../services/PersonService";
import { signToken } from "../middleware/auth";
import { AppDataSource } from "../database/data-source";
import { CommunityMembership } from "../database/entities/CommunityMembership";
import { Community } from "../database/entities/Community";

const sessions = new EventEmitter();
sessions.setMaxListeners(500);
const sessionResults = new Map<string, object>();
const sessionReturnTo = new Map<string, string>();
setInterval(() => { sessionResults.clear(); sessionReturnTo.clear(); }, 30 * 60 * 1000);

function serializePerson(p: any) {
    return { id: p.id, ename: p.ename, firstName: p.first_name, lastName: p.last_name, displayName: displayName(p) };
}

export async function getOffer(req: Request, res: Response) {
    const baseUrl = process.env.VITE_PUBLIC_CORE_BASE_URL || `http://localhost:${process.env.PORT || 3002}`;
    const sessionId = uuidv4();
    const returnTo = typeof req.query.returnTo === "string" && req.query.returnTo.startsWith("/") ? req.query.returnTo : "/";
    sessionReturnTo.set(sessionId, returnTo);
    const redirectUrl = new URL("/api/auth/login", baseUrl).toString();
    const offer = `w3ds://auth?redirect=${redirectUrl}&session=${sessionId}&platform=CORE`;
    res.json({ offer, sessionId });
}

export async function epassportLogin(req: Request, res: Response) {
    const { ename, session, signature } = req.body;
    if (!ename || !session || !signature) { res.status(400).json({ error: "Missing ename, session, or signature" }); return; }

    const cached = sessionResults.get(session);
    if (cached) { sessionResults.delete(session); res.json(cached); return; }

    if (process.env.USE_LOCAL_W3DS !== "true") {
        const registryUrl = process.env.PUBLIC_REGISTRY_URL;
        if (!registryUrl) { res.status(500).json({ error: "PUBLIC_REGISTRY_URL not configured" }); return; }
        try {
            const result = await verifySignature({ eName: ename, signature, payload: session, registryBaseUrl: registryUrl });
            if (!result.valid) { res.status(401).json({ error: "Invalid signature" }); return; }
        } catch {
            res.status(401).json({ error: "Signature verification failed" }); return;
        }
    }

    let person = await findOrCreateByEname(ename);
    if (!person.first_name) {
        const profile = await fetchEVaultProfile(ename);
        if (profile?.first_name) {
            person = await updatePerson(person.id, { first_name: profile.first_name, last_name: profile.last_name });
        }
    }

    // Link shell person by email if exists
    const memberRepo = AppDataSource.getRepository(CommunityMembership);
    // (email-based linking handled in admin add flow — not needed at login time)

    const token = signToken({ userId: person.id, ename: person.ename! });
    const returnTo = sessionReturnTo.get(session) ?? "/";
    sessionReturnTo.delete(session);
    const payload = { token, user: serializePerson(person), returnTo };
    sessionResults.set(session, payload);
    sessions.emit(session, payload);
    res.json(payload);
}

export async function sseAuthStream(req: Request, res: Response) {
    const { id } = req.params;
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "Access-Control-Allow-Origin": "*" });
    res.write(": connected\n\n");
    const handler = (data: object) => { res.write(`data: ${JSON.stringify(data)}\n\n`); res.end(); };
    sessions.once(id, handler);
    req.on("close", () => sessions.off(id, handler));
}

export async function devLogin(req: Request, res: Response) {
    if (process.env.NODE_ENV === "production") { res.status(403).json({ error: "Not available in production" }); return; }
    const ename = req.body.ename || "@dev-user";
    let person = await findOrCreateByEname(ename);
    if (!person.first_name) {
        person = await updatePerson(person.id, { first_name: "Dev", last_name: "User" });
    }
    const token = signToken({ userId: person.id, ename: person.ename! });
    res.json({ token, user: serializePerson(person) });
}

export async function getMe(req: Request, res: Response) {
    const { findById } = await import("../services/PersonService");
    const person = await findById(req.user!.userId);
    if (!person) { res.status(404).json({ error: "Person not found" }); return; }

    const memberships = await AppDataSource.getRepository(CommunityMembership).find({
        where: { person_id: person.id },
    });
    const communityIds = memberships.map((m) => m.community_id);
    const communities = communityIds.length
        ? await AppDataSource.getRepository(Community).findByIds(communityIds)
        : [];

    res.json({
        person: serializePerson(person),
        memberships: memberships.map((m) => ({
            communityId: m.community_id,
            isAdmin: m.is_admin,
            isAspirant: m.is_aspirant,
            community: communities.find((c) => c.id === m.community_id),
        })),
    });
}
```

- [ ] **Step 5: Add auth routes to `api/src/index.ts`**

Add these imports at the top (after existing imports):

```typescript
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { requireAuth } from "./middleware/auth";
import { getOffer, epassportLogin, sseAuthStream, devLogin, getMe } from "./controllers/AuthController";
```

Add these routes before `AppDataSource.initialize()`:

```typescript
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => !!req.url?.includes("/stream") } }));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
app.get("/api/auth/offer", authLimiter, getOffer);
app.post("/api/auth/login", authLimiter, epassportLogin);
app.post("/api/auth/dev-login", devLogin);
app.get("/api/auth/sessions/:id", sseAuthStream);
app.get("/api/me", requireAuth, getMe);
```

- [ ] **Step 6: Start API and verify health + dev-login**

```bash
cd /home/serzhilin/Projects/CORE
npm run db:up
cd api && npm run dev &
sleep 3
curl -s http://localhost:3002/api/health | jq
curl -s -X POST http://localhost:3002/api/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{"ename":"@test-user"}' | jq .token
```

Expected: health returns `{"status":"ok","db":"connected"}`. Dev-login returns a JWT string.

- [ ] **Step 7: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add api/src/middleware/ api/src/services/PersonService.ts api/src/controllers/AuthController.ts api/src/index.ts
git commit -m "feat: W3DS ePassport auth — offer, login, SSE, /me"
```

---

## Task 5: Communities API

**Files:**
- Create: `api/src/services/CommunityService.ts`
- Create: `api/src/controllers/CommunityController.ts`
- Modify: `api/src/index.ts` (add community routes)

- [ ] **Step 1: Create `api/src/services/CommunityService.ts`**

```typescript
import { AppDataSource } from "../database/data-source";
import { Community } from "../database/entities/Community";
import { CommunityMembership } from "../database/entities/CommunityMembership";
import { AvailabilityType } from "../database/entities/AvailabilityType";
import { Workgroup } from "../database/entities/Workgroup";
import { WorkgroupMembership } from "../database/entities/WorkgroupMembership";
import { WorkgroupMemberRole } from "../database/entities/WorkgroupMemberRole";
import { Role } from "../database/entities/Role";

const DEFAULT_AVAILABILITY_TYPES = [
    { name: "Vakantie", emoji: "🏖", sort_order: 0 },
    { name: "Burnout", emoji: "🔋", sort_order: 1 },
    { name: "Ziek", emoji: "🤒", sort_order: 2 },
    { name: "Anders", emoji: "📅", sort_order: 3 },
];

export async function createCommunity(data: { name: string; slug: string; description?: string }, creatorPersonId: string): Promise<Community> {
    const communityRepo = AppDataSource.getRepository(Community);
    const memberRepo = AppDataSource.getRepository(CommunityMembership);
    const atRepo = AppDataSource.getRepository(AvailabilityType);

    const community = await communityRepo.save(communityRepo.create({ name: data.name, slug: data.slug, description: data.description ?? null }));

    // Auto-join creator as admin
    await memberRepo.save(memberRepo.create({ person_id: creatorPersonId, community_id: community.id, is_admin: true }));

    // Seed default availability types
    await atRepo.save(DEFAULT_AVAILABILITY_TYPES.map((t) => atRepo.create({ ...t, community_id: community.id })));

    return community;
}

export async function getMyCommunities(personId: string): Promise<Community[]> {
    const memberships = await AppDataSource.getRepository(CommunityMembership).find({ where: { person_id: personId } });
    if (!memberships.length) return [];
    return AppDataSource.getRepository(Community).findByIds(memberships.map((m) => m.community_id));
}

export async function getCommunityFull(communityId: string, personId: string) {
    const community = await AppDataSource.getRepository(Community).findOne({ where: { id: communityId } });
    if (!community) return null;

    const memberships = await AppDataSource.getRepository(CommunityMembership).find({ where: { community_id: communityId } });
    const personIds = memberships.map((m) => m.person_id);

    const { Person } = await import("../database/entities/Person");
    const persons = personIds.length ? await AppDataSource.getRepository(Person).findByIds(personIds) : [];

    const workgroups = await AppDataSource.getRepository(Workgroup).find({
        where: { community_id: communityId },
        order: { sort_order: "ASC" },
    });

    const wgIds = workgroups.map((w) => w.id);
    const wgMemberships = wgIds.length
        ? await AppDataSource.getRepository(WorkgroupMembership).find({ where: wgIds.map((id) => ({ workgroup_id: id })) })
        : [];
    const roleIds = wgMemberships.map((m) => m.id);
    const wgRoles = roleIds.length
        ? await AppDataSource.getRepository(WorkgroupMemberRole).find({ where: roleIds.map((id) => ({ workgroup_membership_id: id })) })
        : [];
    const roles = wgIds.length
        ? await AppDataSource.getRepository(Role).find({ where: wgIds.map((id) => ({ workgroup_id: id })) })
        : [];

    const availabilityTypeIds = [...new Set(memberships.map((m) => m.availability_type_id).filter(Boolean))];
    const availabilityTypes = availabilityTypeIds.length
        ? await AppDataSource.getRepository(AvailabilityType).findByIds(availabilityTypeIds)
        : [];
    const atMap = Object.fromEntries(availabilityTypes.map((t) => [t.id, t]));

    return {
        ...community,
        members: memberships.map((m) => {
            const person = persons.find((p) => p.id === m.person_id);
            const at = m.availability_type_id ? atMap[m.availability_type_id] : null;
            return {
                membershipId: m.id,
                personId: m.person_id,
                firstName: person?.first_name ?? null,
                lastName: person?.last_name ?? null,
                email: person?.email ?? null,
                avatarUrl: person?.avatar_url ?? null,
                isAdmin: m.is_admin,
                isAspirant: m.is_aspirant,
                joinedAt: m.joined_at,
                availability: at ? { type: { id: at.id, name: at.name, emoji: at.emoji }, reason: m.availability_reason, from: m.availability_from, until: m.availability_until } : null,
            };
        }),
        workgroups: workgroups.map((wg) => {
            const wgMembs = wgMemberships.filter((m) => m.workgroup_id === wg.id);
            return {
                ...wg,
                roles: roles.filter((r) => r.workgroup_id === wg.id),
                members: wgMembs.map((wm) => ({
                    ...wm,
                    roles: wgRoles.filter((r) => r.workgroup_membership_id === wm.id).map((r) => r.role_id),
                })),
            };
        }),
    };
}

export async function updateCommunity(id: string, data: Partial<Pick<Community, "name" | "slug" | "description" | "logo_url" | "primary_color" | "title_font">>): Promise<Community> {
    const repo = AppDataSource.getRepository(Community);
    const community = await repo.findOneOrFail({ where: { id } });
    Object.assign(community, data);
    return repo.save(community);
}
```

- [ ] **Step 2: Create `api/src/controllers/CommunityController.ts`**

```typescript
import { Request, Response } from "express";
import { createCommunity, getMyCommunities, getCommunityFull, updateCommunity } from "../services/CommunityService";

export async function listCommunities(req: Request, res: Response) {
    const communities = await getMyCommunities(req.user!.userId);
    res.json(communities);
}

export async function createCommunityHandler(req: Request, res: Response) {
    const { name, slug, description } = req.body;
    if (!name || !slug) { res.status(400).json({ error: "name and slug are required" }); return; }
    try {
        const community = await createCommunity({ name, slug, description }, req.user!.userId);
        res.status(201).json(community);
    } catch (err: any) {
        if (err.code === "23505") { res.status(409).json({ error: "Slug already taken" }); return; }
        throw err;
    }
}

export async function getCommunityHandler(req: Request, res: Response) {
    const community = await getCommunityFull(req.params.id, req.user!.userId);
    if (!community) { res.status(404).json({ error: "Community not found" }); return; }
    res.json(community);
}

export async function updateCommunityHandler(req: Request, res: Response) {
    const { name, slug, description, logo_url, primary_color, title_font } = req.body;
    const community = await updateCommunity(req.params.id, { name, slug, description, logo_url, primary_color, title_font });
    res.json(community);
}
```

- [ ] **Step 3: Add community routes to `api/src/index.ts`**

Add imports:
```typescript
import { requireCommunityMember, requireCommunityAdmin } from "./middleware/communityAccess";
import { listCommunities, createCommunityHandler, getCommunityHandler, updateCommunityHandler } from "./controllers/CommunityController";
```

Add routes:
```typescript
app.get("/api/communities", requireAuth, listCommunities);
app.post("/api/communities", requireAuth, createCommunityHandler);
app.get("/api/communities/:id", requireAuth, requireCommunityMember, getCommunityHandler);
app.patch("/api/communities/:id", requireAuth, requireCommunityAdmin, updateCommunityHandler);
```

- [ ] **Step 4: Test community creation**

Get a token first:
```bash
TOKEN=$(curl -s -X POST http://localhost:3002/api/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{"ename":"@admin-user"}' | jq -r .token)

curl -s -X POST http://localhost:3002/api/communities \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Coop","slug":"test-coop"}' | jq .id

curl -s http://localhost:3002/api/communities \
  -H "Authorization: Bearer $TOKEN" | jq '.[0].name'
```

Expected: community id returned, then `"Test Coop"`.

- [ ] **Step 5: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add api/src/services/CommunityService.ts api/src/controllers/CommunityController.ts api/src/index.ts
git commit -m "feat: communities API — list, create, get full, update"
```

---

## Task 6: Availability State Machine + Members API (with tests)

**Files:**
- Create: `api/src/services/AvailabilityService.ts`
- Create: `api/src/services/__tests__/AvailabilityService.test.ts`
- Create: `api/src/services/MemberService.ts`
- Create: `api/src/controllers/MemberController.ts`
- Modify: `api/src/index.ts`

- [ ] **Step 1: Write failing tests for the availability state machine**

Create `api/src/services/__tests__/AvailabilityService.test.ts`:

```typescript
import { computeAvailabilityChanges } from "../AvailabilityService";

const TODAY = new Date("2026-04-21");
const TYPE_A = "type-a-uuid";
const TYPE_B = "type-b-uuid";

describe("computeAvailabilityChanges", () => {
    it("clear when no current availability — no log, clears fields", () => {
        const result = computeAvailabilityChanges(
            { type_id: null, reason: null, from: null, until: null },
            { clear: true, type_id: null, reason: null, until: null },
            TODAY
        );
        expect(result.log).toBeNull();
        expect(result.next.type_id).toBeNull();
    });

    it("clear when has availability — writes log with today as until_date", () => {
        const from = new Date("2026-04-01");
        const result = computeAvailabilityChanges(
            { type_id: TYPE_A, reason: "holiday", from, until: null },
            { clear: true, type_id: null, reason: null, until: null },
            TODAY
        );
        expect(result.log).not.toBeNull();
        expect(result.log!.until_date).toEqual(TODAY);
        expect(result.log!.from_date).toEqual(from);
        expect(result.next.type_id).toBeNull();
    });

    it("same type — updates reason and until, from stays unchanged", () => {
        const originalFrom = new Date("2026-04-10");
        const result = computeAvailabilityChanges(
            { type_id: TYPE_A, reason: "old reason", from: originalFrom, until: null },
            { clear: false, type_id: TYPE_A, reason: "new reason", until: new Date("2026-05-01") },
            TODAY
        );
        expect(result.log).toBeNull();
        expect(result.next.from).toEqual(originalFrom);
        expect(result.next.reason).toBe("new reason");
        expect(result.next.until?.toISOString()).toBe(new Date("2026-05-01").toISOString());
    });

    it("different type — logs old, sets new type with from = today", () => {
        const originalFrom = new Date("2026-04-01");
        const result = computeAvailabilityChanges(
            { type_id: TYPE_A, reason: "tired", from: originalFrom, until: null },
            { clear: false, type_id: TYPE_B, reason: "sick now", until: null },
            TODAY
        );
        expect(result.log).not.toBeNull();
        expect(result.log!.until_date).toEqual(TODAY);
        expect(result.next.type_id).toBe(TYPE_B);
        expect(result.next.from).toEqual(TODAY);
        expect(result.next.reason).toBe("sick now");
    });

    it("first time setting availability — no log, sets type and from = today", () => {
        const result = computeAvailabilityChanges(
            { type_id: null, reason: null, from: null, until: null },
            { clear: false, type_id: TYPE_A, reason: "vacation", until: null },
            TODAY
        );
        expect(result.log).toBeNull();
        expect(result.next.type_id).toBe(TYPE_A);
        expect(result.next.from).toEqual(TODAY);
    });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /home/serzhilin/Projects/CORE/api
npx jest --testPathPattern=AvailabilityService
```

Expected: `Cannot find module '../AvailabilityService'` — correct, it doesn't exist yet.

- [ ] **Step 3: Create `api/src/services/AvailabilityService.ts`**

```typescript
import { AppDataSource } from "../database/data-source";
import { CommunityMembership } from "../database/entities/CommunityMembership";
import { AvailabilityLog } from "../database/entities/AvailabilityLog";
import { AvailabilityType } from "../database/entities/AvailabilityType";

export interface AvailabilityState {
    type_id: string | null;
    reason: string | null;
    from: Date | null;
    until: Date | null;
}

export interface AvailabilityPayload {
    clear: boolean;
    type_id: string | null;
    reason: string | null;
    until: Date | null;
}

export interface AvailabilityChanges {
    log: { type_id: string; type_name: string; type_emoji: string; reason: string | null; from_date: Date; until_date: Date } | null;
    next: AvailabilityState;
}

/** Pure function — computes what changes to make given current state + payload. No DB access. */
export function computeAvailabilityChanges(
    current: AvailabilityState,
    payload: AvailabilityPayload,
    today: Date,
    typeName = "",
    typeEmoji = ""
): AvailabilityChanges {
    if (payload.clear) {
        const log = current.type_id
            ? { type_id: current.type_id, type_name: typeName, type_emoji: typeEmoji, reason: current.reason, from_date: current.from!, until_date: today }
            : null;
        return { log, next: { type_id: null, reason: null, from: null, until: null } };
    }

    if (payload.type_id === current.type_id && current.type_id !== null) {
        // Same type — extend reason/until, keep from
        return {
            log: null,
            next: { type_id: current.type_id, reason: payload.reason, from: current.from, until: payload.until },
        };
    }

    // New type
    const log = current.type_id
        ? { type_id: current.type_id, type_name: typeName, type_emoji: typeEmoji, reason: current.reason, from_date: current.from!, until_date: today }
        : null;
    return {
        log,
        next: { type_id: payload.type_id, reason: payload.reason, from: today, until: payload.until },
    };
}

/** Applies availability change to DB for a CommunityMembership. */
export async function applyAvailability(membershipId: string, payload: AvailabilityPayload): Promise<CommunityMembership> {
    const memberRepo = AppDataSource.getRepository(CommunityMembership);
    const logRepo = AppDataSource.getRepository(AvailabilityLog);
    const atRepo = AppDataSource.getRepository(AvailabilityType);

    const m = await memberRepo.findOneOrFail({ where: { id: membershipId } });
    const today = new Date();

    let typeName = "";
    let typeEmoji = "";
    if (m.availability_type_id) {
        const at = await atRepo.findOne({ where: { id: m.availability_type_id } });
        typeName = at?.name ?? "";
        typeEmoji = at?.emoji ?? "";
    }

    const { log, next } = computeAvailabilityChanges(
        { type_id: m.availability_type_id, reason: m.availability_reason, from: m.availability_from, until: m.availability_until },
        payload,
        today,
        typeName,
        typeEmoji
    );

    if (log) {
        await logRepo.save(logRepo.create({
            community_membership_id: membershipId,
            type_name: log.type_name,
            type_emoji: log.type_emoji,
            reason: log.reason,
            from_date: log.from_date,
            until_date: log.until_date,
        }));
    }

    m.availability_type_id = next.type_id;
    m.availability_reason = next.reason;
    m.availability_from = next.from;
    m.availability_until = next.until;
    return memberRepo.save(m);
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd /home/serzhilin/Projects/CORE/api
npx jest --testPathPattern=AvailabilityService
```

Expected: 5 tests pass.

- [ ] **Step 5: Create `api/src/services/MemberService.ts`**

```typescript
import { AppDataSource } from "../database/data-source";
import { CommunityMembership } from "../database/entities/CommunityMembership";
import { Person } from "../database/entities/Person";
import { AvailabilityLog } from "../database/entities/AvailabilityLog";

const memberRepo = () => AppDataSource.getRepository(CommunityMembership);
const personRepo = () => AppDataSource.getRepository(Person);

export async function listMembers(communityId: string) {
    return memberRepo().find({ where: { community_id: communityId } });
}

export async function addMember(communityId: string, data: { first_name: string; last_name: string; email?: string }): Promise<CommunityMembership> {
    // Reuse shell Person with matching email, else create new
    let person: Person | null = null;
    if (data.email) {
        person = await personRepo().findOne({ where: { email: data.email } });
    }
    if (!person) {
        person = await personRepo().save(personRepo().create({
            first_name: data.first_name,
            last_name: data.last_name,
            email: data.email ?? null,
        }));
    }
    return memberRepo().save(memberRepo().create({ person_id: person.id, community_id: communityId }));
}

export async function updateMember(membershipId: string, data: Partial<Pick<CommunityMembership, "is_admin" | "is_aspirant" | "joined_at">>): Promise<CommunityMembership> {
    const m = await memberRepo().findOneOrFail({ where: { id: membershipId } });
    Object.assign(m, data);
    return memberRepo().save(m);
}

export async function removeMember(communityId: string, membershipId: string): Promise<void> {
    await memberRepo().delete({ id: membershipId, community_id: communityId });
}

export async function getMemberAvailabilityLog(membershipId: string) {
    return AppDataSource.getRepository(AvailabilityLog).find({
        where: { community_membership_id: membershipId },
        order: { created_at: "DESC" },
    });
}
```

- [ ] **Step 6: Create `api/src/controllers/MemberController.ts`**

```typescript
import { Request, Response } from "express";
import { listMembers, addMember, updateMember, removeMember, getMemberAvailabilityLog } from "../services/MemberService";
import { applyAvailability } from "../services/AvailabilityService";
import { AppDataSource } from "../database/data-source";
import { CommunityMembership } from "../database/entities/CommunityMembership";

export async function listMembersHandler(req: Request, res: Response) {
    res.json(await listMembers(req.params.cid));
}

export async function addMemberHandler(req: Request, res: Response) {
    const { first_name, last_name, email } = req.body;
    if (!first_name || !last_name) { res.status(400).json({ error: "first_name and last_name are required" }); return; }
    const m = await addMember(req.params.cid, { first_name, last_name, email });
    res.status(201).json(m);
}

export async function updateMemberHandler(req: Request, res: Response) {
    const { is_admin, is_aspirant, joined_at } = req.body;
    const m = await updateMember(req.params.pid, { is_admin, is_aspirant, joined_at });
    res.json(m);
}

export async function deleteMemberHandler(req: Request, res: Response) {
    await removeMember(req.params.cid, req.params.pid);
    res.status(204).send();
}

export async function setMyAvailability(req: Request, res: Response) {
    const m = await AppDataSource.getRepository(CommunityMembership).findOne({
        where: { person_id: req.user!.userId, community_id: req.params.cid },
    });
    if (!m) { res.status(404).json({ error: "Membership not found" }); return; }
    const { type_id, reason, until, clear } = req.body;
    const updated = await applyAvailability(m.id, { type_id: type_id ?? null, reason: reason ?? null, until: until ? new Date(until) : null, clear: !!clear });
    res.json(updated);
}

export async function setMemberAvailability(req: Request, res: Response) {
    const { type_id, reason, until, clear } = req.body;
    const updated = await applyAvailability(req.params.pid, { type_id: type_id ?? null, reason: reason ?? null, until: until ? new Date(until) : null, clear: !!clear });
    res.json(updated);
}

export async function getMemberAvailabilityLogHandler(req: Request, res: Response) {
    res.json(await getMemberAvailabilityLog(req.params.pid));
}
```

- [ ] **Step 7: Add member routes to `api/src/index.ts`**

Add imports:
```typescript
import { listMembersHandler, addMemberHandler, updateMemberHandler, deleteMemberHandler, setMyAvailability, setMemberAvailability, getMemberAvailabilityLogHandler } from "./controllers/MemberController";
```

Add routes:
```typescript
app.get("/api/communities/:cid/members", requireAuth, requireCommunityMember, listMembersHandler);
app.post("/api/communities/:cid/members", requireAuth, requireCommunityAdmin, addMemberHandler);
app.patch("/api/communities/:cid/members/:pid", requireAuth, requireCommunityAdmin, updateMemberHandler);
app.delete("/api/communities/:cid/members/:pid", requireAuth, requireCommunityAdmin, deleteMemberHandler);
app.patch("/api/communities/:cid/me/availability", requireAuth, requireCommunityMember, setMyAvailability);
app.patch("/api/communities/:cid/members/:pid/availability", requireAuth, requireCommunityAdmin, setMemberAvailability);
app.get("/api/communities/:cid/members/:pid/availability-log", requireAuth, requireCommunityAdmin, getMemberAvailabilityLogHandler);
```

- [ ] **Step 8: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add api/src/services/AvailabilityService.ts api/src/services/__tests__/ api/src/services/MemberService.ts api/src/controllers/MemberController.ts api/src/index.ts
git commit -m "feat: members API + availability state machine (5 tests green)"
```

---

## Task 7: Availability Types API

**Files:**
- Create: `api/src/services/AvailabilityTypeService.ts`
- Create: `api/src/controllers/AvailabilityTypeController.ts`
- Modify: `api/src/index.ts`

- [ ] **Step 1: Create `api/src/services/AvailabilityTypeService.ts`**

```typescript
import { AppDataSource } from "../database/data-source";
import { AvailabilityType } from "../database/entities/AvailabilityType";
import { CommunityMembership } from "../database/entities/CommunityMembership";

const repo = () => AppDataSource.getRepository(AvailabilityType);

export async function listAvailabilityTypes(communityId: string): Promise<AvailabilityType[]> {
    return repo().find({ where: { community_id: communityId, is_archived: false }, order: { sort_order: "ASC" } });
}

export async function createAvailabilityType(communityId: string, data: { name: string; emoji: string }): Promise<AvailabilityType> {
    const maxOrder = await repo().maximum("sort_order", { community_id: communityId }) ?? -1;
    return repo().save(repo().create({ community_id: communityId, name: data.name, emoji: data.emoji, sort_order: (maxOrder as number) + 1 }));
}

export async function updateAvailabilityType(id: string, communityId: string, data: Partial<Pick<AvailabilityType, "name" | "emoji" | "sort_order">>): Promise<AvailabilityType> {
    const at = await repo().findOneOrFail({ where: { id, community_id: communityId } });
    Object.assign(at, data);
    return repo().save(at);
}

export async function archiveAvailabilityType(id: string, communityId: string): Promise<void> {
    // Check if in use — prevent archiving active-use types only if they have current members
    const inUse = await AppDataSource.getRepository(CommunityMembership).count({ where: { community_id: communityId, availability_type_id: id } });
    if (inUse > 0) throw new Error("IN_USE");
    await repo().update({ id, community_id: communityId }, { is_archived: true });
}
```

- [ ] **Step 2: Create `api/src/controllers/AvailabilityTypeController.ts`**

```typescript
import { Request, Response } from "express";
import { listAvailabilityTypes, createAvailabilityType, updateAvailabilityType, archiveAvailabilityType } from "../services/AvailabilityTypeService";

export async function listHandler(req: Request, res: Response) {
    res.json(await listAvailabilityTypes(req.params.cid));
}

export async function createHandler(req: Request, res: Response) {
    const { name, emoji } = req.body;
    if (!name || !emoji) { res.status(400).json({ error: "name and emoji required" }); return; }
    res.status(201).json(await createAvailabilityType(req.params.cid, { name, emoji }));
}

export async function updateHandler(req: Request, res: Response) {
    const { name, emoji, sort_order } = req.body;
    res.json(await updateAvailabilityType(req.params.tid, req.params.cid, { name, emoji, sort_order }));
}

export async function archiveHandler(req: Request, res: Response) {
    try {
        await archiveAvailabilityType(req.params.tid, req.params.cid);
        res.status(204).send();
    } catch (err: any) {
        if (err.message === "IN_USE") { res.status(409).json({ error: "Type is currently in use by members" }); return; }
        throw err;
    }
}
```

- [ ] **Step 3: Add routes to `api/src/index.ts`**

Add imports:
```typescript
import { listHandler as listAtHandler, createHandler as createAtHandler, updateHandler as updateAtHandler, archiveHandler as archiveAtHandler } from "./controllers/AvailabilityTypeController";
```

Add routes:
```typescript
app.get("/api/communities/:cid/availability-types", requireAuth, requireCommunityMember, listAtHandler);
app.post("/api/communities/:cid/availability-types", requireAuth, requireCommunityAdmin, createAtHandler);
app.patch("/api/communities/:cid/availability-types/:tid", requireAuth, requireCommunityAdmin, updateAtHandler);
app.delete("/api/communities/:cid/availability-types/:tid", requireAuth, requireCommunityAdmin, archiveAtHandler);
```

- [ ] **Step 4: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add api/src/services/AvailabilityTypeService.ts api/src/controllers/AvailabilityTypeController.ts api/src/index.ts
git commit -m "feat: availability types API — list, create, update, archive"
```

---

## Task 8: Workgroups, Roles & Workgroup Memberships API

**Files:**
- Create: `api/src/services/WorkgroupService.ts`
- Create: `api/src/controllers/WorkgroupController.ts`
- Modify: `api/src/index.ts`

- [ ] **Step 1: Create `api/src/services/WorkgroupService.ts`**

```typescript
import { AppDataSource } from "../database/data-source";
import { Workgroup } from "../database/entities/Workgroup";
import { Role } from "../database/entities/Role";
import { WorkgroupMembership } from "../database/entities/WorkgroupMembership";
import { WorkgroupMemberRole } from "../database/entities/WorkgroupMemberRole";

const wgRepo = () => AppDataSource.getRepository(Workgroup);
const roleRepo = () => AppDataSource.getRepository(Role);
const wgmRepo = () => AppDataSource.getRepository(WorkgroupMembership);
const wmrRepo = () => AppDataSource.getRepository(WorkgroupMemberRole);

export async function listWorkgroups(communityId: string) {
    return wgRepo().find({ where: { community_id: communityId }, order: { sort_order: "ASC" } });
}

export async function createWorkgroup(communityId: string, data: { name: string; description?: string; color?: string }): Promise<Workgroup> {
    const maxOrder = (await wgRepo().maximum("sort_order", { community_id: communityId }) as number | null) ?? -1;
    return wgRepo().save(wgRepo().create({ community_id: communityId, name: data.name, description: data.description ?? null, color: data.color ?? "#C4622D", sort_order: maxOrder + 1 }));
}

export async function updateWorkgroup(id: string, communityId: string, data: Partial<Pick<Workgroup, "name" | "description" | "color" | "sort_order">>): Promise<Workgroup> {
    const wg = await wgRepo().findOneOrFail({ where: { id, community_id: communityId } });
    Object.assign(wg, data);
    return wgRepo().save(wg);
}

export async function deleteWorkgroup(id: string, communityId: string): Promise<void> {
    await wgRepo().delete({ id, community_id: communityId });
}

export async function createRole(workgroupId: string, data: { name: string; description?: string; color?: string }): Promise<Role> {
    const maxOrder = (await roleRepo().maximum("sort_order", { workgroup_id: workgroupId }) as number | null) ?? -1;
    return roleRepo().save(roleRepo().create({ workgroup_id: workgroupId, name: data.name, description: data.description ?? null, color: data.color ?? "#C4622D", sort_order: maxOrder + 1 }));
}

export async function updateRole(id: string, workgroupId: string, data: Partial<Pick<Role, "name" | "description" | "color" | "sort_order">>): Promise<Role> {
    const role = await roleRepo().findOneOrFail({ where: { id, workgroup_id: workgroupId } });
    Object.assign(role, data);
    return roleRepo().save(role);
}

export async function deleteRole(id: string, workgroupId: string): Promise<void> {
    await roleRepo().delete({ id, workgroup_id: workgroupId });
}

export async function addWorkgroupMember(workgroupId: string, personId: string): Promise<WorkgroupMembership> {
    return wgmRepo().save(wgmRepo().create({ workgroup_id: workgroupId, person_id: personId }));
}

export async function updateWorkgroupMember(workgroupMembershipId: string, data: { is_workgroup_admin: boolean }): Promise<WorkgroupMembership> {
    const wm = await wgmRepo().findOneOrFail({ where: { id: workgroupMembershipId } });
    wm.is_workgroup_admin = data.is_workgroup_admin;
    return wgmRepo().save(wm);
}

export async function removeWorkgroupMember(workgroupId: string, personId: string): Promise<void> {
    await wgmRepo().delete({ workgroup_id: workgroupId, person_id: personId });
}

export async function assignRole(workgroupMembershipId: string, roleId: string): Promise<WorkgroupMemberRole> {
    return wmrRepo().save(wmrRepo().create({ workgroup_membership_id: workgroupMembershipId, role_id: roleId }));
}

export async function unassignRole(workgroupMembershipId: string, roleId: string): Promise<void> {
    await wmrRepo().delete({ workgroup_membership_id: workgroupMembershipId, role_id: roleId });
}

export async function getWorkgroupMembership(workgroupId: string, personId: string): Promise<WorkgroupMembership | null> {
    return wgmRepo().findOne({ where: { workgroup_id: workgroupId, person_id: personId } });
}
```

- [ ] **Step 2: Create `api/src/controllers/WorkgroupController.ts`**

```typescript
import { Request, Response } from "express";
import {
    listWorkgroups, createWorkgroup, updateWorkgroup, deleteWorkgroup,
    createRole, updateRole, deleteRole,
    addWorkgroupMember, updateWorkgroupMember, removeWorkgroupMember,
    assignRole, unassignRole, getWorkgroupMembership,
} from "../services/WorkgroupService";

export const listWorkgroupsHandler = async (req: Request, res: Response) =>
    res.json(await listWorkgroups(req.params.cid));

export const createWorkgroupHandler = async (req: Request, res: Response) => {
    const { name, description, color } = req.body;
    if (!name) { res.status(400).json({ error: "name required" }); return; }
    res.status(201).json(await createWorkgroup(req.params.cid, { name, description, color }));
};

export const updateWorkgroupHandler = async (req: Request, res: Response) =>
    res.json(await updateWorkgroup(req.params.wid, req.params.cid, req.body));

export const deleteWorkgroupHandler = async (req: Request, res: Response) => {
    await deleteWorkgroup(req.params.wid, req.params.cid);
    res.status(204).send();
};

export const createRoleHandler = async (req: Request, res: Response) => {
    const { name, description, color } = req.body;
    if (!name) { res.status(400).json({ error: "name required" }); return; }
    res.status(201).json(await createRole(req.params.wid, { name, description, color }));
};

export const updateRoleHandler = async (req: Request, res: Response) =>
    res.json(await updateRole(req.params.rid, req.params.wid, req.body));

export const deleteRoleHandler = async (req: Request, res: Response) => {
    await deleteRole(req.params.rid, req.params.wid);
    res.status(204).send();
};

export const addWgMemberHandler = async (req: Request, res: Response) => {
    const { person_id } = req.body;
    if (!person_id) { res.status(400).json({ error: "person_id required" }); return; }
    try {
        res.status(201).json(await addWorkgroupMember(req.params.wid, person_id));
    } catch (err: any) {
        if (err.code === "23505") { res.status(409).json({ error: "Already a member" }); return; }
        throw err;
    }
};

export const updateWgMemberHandler = async (req: Request, res: Response) =>
    res.json(await updateWorkgroupMember(req.params.pid, { is_workgroup_admin: !!req.body.is_workgroup_admin }));

export const removeWgMemberHandler = async (req: Request, res: Response) => {
    await removeWorkgroupMember(req.params.wid, req.params.pid);
    res.status(204).send();
};

export const assignRoleHandler = async (req: Request, res: Response) => {
    const { role_id } = req.body;
    if (!role_id) { res.status(400).json({ error: "role_id required" }); return; }
    const wm = await getWorkgroupMembership(req.params.wid, req.params.pid);
    if (!wm) { res.status(404).json({ error: "Workgroup membership not found" }); return; }
    try {
        res.status(201).json(await assignRole(wm.id, role_id));
    } catch (err: any) {
        if (err.code === "23505") { res.status(409).json({ error: "Role already assigned" }); return; }
        throw err;
    }
};

export const unassignRoleHandler = async (req: Request, res: Response) => {
    const wm = await getWorkgroupMembership(req.params.wid, req.params.pid);
    if (!wm) { res.status(404).json({ error: "Workgroup membership not found" }); return; }
    await unassignRole(wm.id, req.params.rid);
    res.status(204).send();
};
```

- [ ] **Step 3: Add workgroup routes to `api/src/index.ts`**

Add imports:
```typescript
import {
    listWorkgroupsHandler, createWorkgroupHandler, updateWorkgroupHandler, deleteWorkgroupHandler,
    createRoleHandler, updateRoleHandler, deleteRoleHandler,
    addWgMemberHandler, updateWgMemberHandler, removeWgMemberHandler,
    assignRoleHandler, unassignRoleHandler,
} from "./controllers/WorkgroupController";
```

Add routes:
```typescript
app.get("/api/communities/:cid/workgroups", requireAuth, requireCommunityMember, listWorkgroupsHandler);
app.post("/api/communities/:cid/workgroups", requireAuth, requireCommunityAdmin, createWorkgroupHandler);
app.patch("/api/communities/:cid/workgroups/:wid", requireAuth, requireCommunityAdmin, updateWorkgroupHandler);
app.delete("/api/communities/:cid/workgroups/:wid", requireAuth, requireCommunityAdmin, deleteWorkgroupHandler);

app.post("/api/workgroups/:wid/roles", requireAuth, createRoleHandler);
app.patch("/api/workgroups/:wid/roles/:rid", requireAuth, updateRoleHandler);
app.delete("/api/workgroups/:wid/roles/:rid", requireAuth, deleteRoleHandler);

app.post("/api/workgroups/:wid/members", requireAuth, addWgMemberHandler);
app.patch("/api/workgroups/:wid/members/:pid", requireAuth, updateWgMemberHandler);
app.delete("/api/workgroups/:wid/members/:pid", requireAuth, removeWgMemberHandler);
app.post("/api/workgroups/:wid/members/:pid/roles", requireAuth, assignRoleHandler);
app.delete("/api/workgroups/:wid/members/:pid/roles/:rid", requireAuth, unassignRoleHandler);
```

- [ ] **Step 4: Run all tests**

```bash
cd /home/serzhilin/Projects/CORE/api
npx jest
```

Expected: 5 tests pass (availability state machine).

- [ ] **Step 5: Commit**

```bash
cd /home/serzhilin/Projects/CORE
git add api/src/services/WorkgroupService.ts api/src/controllers/WorkgroupController.ts api/src/index.ts
git commit -m "feat: workgroups, roles, and workgroup membership API"
```

---

## Task 9: W3DS Stubs + Final Type Check

**Files:**
- Modify: `api/src/web3adapter/subscriber.ts` (already stubbed — expand comment)
- Create: `api/src/web3adapter/mappings/community.mapping.json`
- Create: `api/src/web3adapter/mappings/person.mapping.json`

- [ ] **Step 1: Update `api/src/web3adapter/subscriber.ts`**

```typescript
import { EntitySubscriberInterface, EventSubscriber, InsertEvent, UpdateEvent } from "typeorm";

@EventSubscriber()
export class CoreSubscriber implements EntitySubscriberInterface {
    // Phase 2: wire eVault sync here.
    // Community → GroupManifest schema a8bfb7cf-3200-4b25-9ea9-ee41100f212e
    // Person → User profile schema 550e8400-e29b-41d4-a716-446655440000
}
```

- [ ] **Step 2: Create `api/src/web3adapter/mappings/community.mapping.json`**

```json
{
  "_comment": "Phase 2 stub — maps Community entity to W3DS GroupManifest",
  "schemaId": "a8bfb7cf-3200-4b25-9ea9-ee41100f212e",
  "tableName": "communities",
  "fields": {}
}
```

- [ ] **Step 3: Create `api/src/web3adapter/mappings/person.mapping.json`**

```json
{
  "_comment": "Phase 2 stub — maps Person entity to W3DS User profile",
  "schemaId": "550e8400-e29b-41d4-a716-446655440000",
  "tableName": "persons",
  "fields": {}
}
```

- [ ] **Step 4: Final TypeScript check**

```bash
cd /home/serzhilin/Projects/CORE/api
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Final test run**

```bash
npx jest
```

Expected: 5 tests pass.

- [ ] **Step 6: Start full API and smoke-test all route groups**

```bash
cd /home/serzhilin/Projects/CORE
npm run db:up
cd api && npm run dev &
sleep 3

TOKEN=$(curl -s -X POST http://localhost:3002/api/auth/dev-login \
  -H "Content-Type: application/json" -d '{"ename":"@smoke-test"}' | jq -r .token)

# Create community
CID=$(curl -s -X POST http://localhost:3002/api/communities \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Smoke Coop","slug":"smoke-coop"}' | jq -r .id)

# List availability types (should have 4 defaults)
curl -s http://localhost:3002/api/communities/$CID/availability-types \
  -H "Authorization: Bearer $TOKEN" | jq 'length'

# Create workgroup
WID=$(curl -s -X POST http://localhost:3002/api/communities/$CID/workgroups \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Board","color":"#2D4CC4"}' | jq -r .id)

# Create role in workgroup
curl -s -X POST http://localhost:3002/api/workgroups/$WID/roles \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Voorzitter","color":"#C4622D"}' | jq .name

echo "All smoke tests passed"
```

Expected: `4` (default availability types), `"Voorzitter"`.

- [ ] **Step 7: Final commit**

```bash
cd /home/serzhilin/Projects/CORE
git add api/src/web3adapter/
git commit -m "feat: W3DS Phase 2 stubs — subscriber + mapping JSON placeholders"
```

---

## Self-Review

**Spec coverage check:**

| Spec section | Covered? |
|---|---|
| §1 Stack & Scaffold | ✅ Task 1–2 |
| §2 All 9 entities | ✅ Task 3 |
| §3 Permissions (is_admin, communityAccess) | ✅ Task 4 middleware |
| §4 Auth routes | ✅ Task 4 |
| §4 /api/me | ✅ Task 4 |
| §4 PATCH /api/me | ❌ Missing — add to MemberController |
| §4 Communities routes | ✅ Task 5 |
| §4 Members routes | ✅ Task 6 |
| §4 Availability types routes | ✅ Task 7 |
| §4 Workgroups routes | ✅ Task 8 |
| §4 Roles routes | ✅ Task 8 |
| §4 Workgroup membership routes | ✅ Task 8 |
| §7 Availability logic | ✅ Task 6 (5 unit tests) |
| §8 W3DS stubs | ✅ Task 9 |
| §9 Deployment | Covered in `core-deploy.md` |

**Gap fix — `PATCH /api/me`:**

Add to `api/src/controllers/AuthController.ts`:

```typescript
export async function updateMe(req: Request, res: Response) {
    const { first_name, last_name, email, phone, bio, avatar_url } = req.body;
    const { updatePerson } = await import("../services/PersonService");
    const person = await updatePerson(req.user!.userId, { first_name, last_name, email, phone, bio, avatar_url });
    res.json(serializePerson(person));
}
```

Add to `api/src/index.ts`:
```typescript
import { ..., updateMe } from "./controllers/AuthController";
// ...
app.patch("/api/me", requireAuth, updateMe);
```

Commit:
```bash
git add api/src/controllers/AuthController.ts api/src/index.ts
git commit -m "fix: add PATCH /api/me — update own person profile"
```
