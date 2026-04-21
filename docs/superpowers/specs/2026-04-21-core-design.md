# CORE — Community Organisation & Roles Engine
### Design Specification — 2026-04-21

**What it is:** A multi-community platform for creating and managing communities, their members, workgroups, and roles. The organogram view is the heart of the app. W3DS ePassport auth from day one; eVault sync stubbed for Phase 2.

**Relationship to ALVer:** CORE eventually replaces ALVer's community management. ALVer becomes voting-only; CORE becomes the source of truth for community identity and structure. Sync between them will happen via W3DS GroupManifest in Phase 2.

---

## 1. Stack & Scaffold

Identical to ALVer — copy structure, style system, auth pattern:

| Layer | Technology |
|---|---|
| Backend | Node.js + Express + TypeORM + PostgreSQL |
| Frontend | React + Vite + Tailwind CSS |
| Auth | W3DS ePassport (signature-validator) + JWT |
| DB container | Docker, port **5434** (ALVer uses 5433) |
| Deploy | Dockerfile multi-stage + docker-compose.prod.yml → Coolify |
| Dev tooling | concurrently (api + app), pnpm |

**Project layout:**
```
CORE/
  package.json                  scripts: dev, db:up, db:down, db:seed
  docker-compose.yml            postgres:5434
  docker-compose.prod.yml
  Dockerfile
  api/
    src/
      database/
        entities/               one file per entity
        data-source.ts
      controllers/
      services/
      middleware/               auth.ts (JWT), community-access.ts
      web3adapter/              stubs — subscriber.ts + mappings/
      index.ts
    package.json
    tsconfig.json
    .env
  app/
    src/
      views/                    one file per page
      components/               shared UI components
      context/                  UserContext, CommunityContext
      api/                      typed fetch wrappers
      index.css                 copied from ALVer (design tokens)
    package.json
    vite.config.js
    .env
```

**Design system** — copy ALVer's `index.css` exactly:
- CSS variables: `--color-cream`, `--color-terracotta`, `--color-charcoal`, `--color-sand`, etc.
- Fonts: Playfair Display (headings) + Inter (body)
- Button classes: `.btn-primary`, `.btn-secondary`
- Card classes: `.card`, `.card-warm`

---

## 2. Data Model

### Person
The human. One record per person across all communities. Linked to a W3DS identity via `ename`.

```typescript
@Entity("persons")
class Person {
  id: uuid (PK)
  ename: string | null         // W3DS W3ID — @uuid format. Linked on first ePassport login
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  bio: string | null
  avatar_url: string | null    // base64 data URL or external URL
  created_at: Date
  updated_at: Date
}
```

### Community
```typescript
@Entity("communities")
class Community {
  id: uuid (PK)
  name: string
  slug: string (unique)
  description: string | null
  logo_url: string | null
  primary_color: string        // default "#C4622D"
  title_font: string           // default "Playfair Display"
  ename: string | null         // W3DS group eVault W3ID — populated in Phase 2
  evault_uri: string | null
  created_at: Date
  updated_at: Date
}
```

### CommunityMembership
Links a Person to a Community. Carries admin flag, aspirant flag, and current availability.

```typescript
@Entity("community_memberships")
class CommunityMembership {
  id: uuid (PK)
  person_id: uuid (FK → Person, CASCADE)
  community_id: uuid (FK → Community, CASCADE)
  is_admin: boolean            // community-level admin
  is_aspirant: boolean         // still in joining process
  joined_at: Date | null       // date of full membership — admin-settable
  availability_type_id: uuid | null  // FK → AvailabilityType (null = available)
  availability_reason: string | null
  availability_from: Date | null     // auto-set when status is set, never editable
  availability_until: Date | null    // optional end date
  created_at: Date
  updated_at: Date
  UNIQUE(person_id, community_id)
}
```

### AvailabilityType
Community-configurable absence types shown in the dropdown.

```typescript
@Entity("availability_types")
class AvailabilityType {
  id: uuid (PK)
  community_id: uuid (FK → Community, CASCADE)
  name: string                 // e.g. "Vakantie"
  emoji: string                // e.g. "🏖"
  sort_order: integer
  is_archived: boolean         // soft-delete — cannot hard-delete if in use
  created_at: Date
}
```

Default types created for every new community:
- 🏖 Vakantie
- 🔋 Burnout
- 🤒 Ziek
- 📅 Anders

### AvailabilityLog
Immutable history of past availability periods. Written when status changes or is cleared.

```typescript
@Entity("availability_logs")
class AvailabilityLog {
  id: uuid (PK)
  community_membership_id: uuid (FK → CommunityMembership, CASCADE)
  type_name: string            // snapshot — survives type renaming/deletion
  type_emoji: string           // snapshot
  reason: string | null
  from_date: Date
  until_date: Date             // set when status changes or is cleared
  created_at: Date
}
```

### Workgroup
Flat — one level only, no nesting.

```typescript
@Entity("workgroups")
class Workgroup {
  id: uuid (PK)
  community_id: uuid (FK → Community, CASCADE)
  name: string
  description: string | null
  color: string                // hex color for card border + organogram
  sort_order: integer
  created_at: Date
  updated_at: Date
}
```

### Role
Defined per workgroup. Not shared across workgroups — each workgroup manages its own.

```typescript
@Entity("roles")
class Role {
  id: uuid (PK)
  workgroup_id: uuid (FK → Workgroup, CASCADE)
  name: string                 // e.g. "Voorzitter"
  description: string | null
  color: string                // hex — shown as dot/fill in organogram
  sort_order: integer
  created_at: Date
  updated_at: Date
}
```

### WorkgroupMembership
The base fact: this person is in this workgroup.

```typescript
@Entity("workgroup_memberships")
class WorkgroupMembership {
  id: uuid (PK)
  person_id: uuid (FK → Person, CASCADE)
  workgroup_id: uuid (FK → Workgroup, CASCADE)
  is_workgroup_admin: boolean  // can manage this workgroup
  created_at: Date
  UNIQUE(person_id, workgroup_id)
}
```

### WorkgroupMemberRole
Zero or more roles per membership. A person can be Facilitator AND Penningmeester in the same workgroup.

```typescript
@Entity("workgroup_member_roles")
class WorkgroupMemberRole {
  id: uuid (PK)
  workgroup_membership_id: uuid (FK → WorkgroupMembership, CASCADE)
  role_id: uuid (FK → Role, CASCADE)
  created_at: Date
  UNIQUE(workgroup_membership_id, role_id)
}
```

---

## 3. Permissions

| Actor | Determined by | Can do |
|---|---|---|
| **Community admin** | `CommunityMembership.is_admin = true` | Full CRUD on community, members, workgroups, roles, availability types |
| **Workgroup admin** | `WorkgroupMembership.is_workgroup_admin = true` | Manage own workgroup: members, roles, workgroup settings |
| **Member** | Has a `CommunityMembership` | View organogram + table. Edit own Person profile. Set own availability. |
| **Unauthenticated** | — | Login screen only |

First person to create a community gets `is_admin = true` automatically.

A workgroup admin who is also a community admin has full access — community admin always wins.

---

## 4. API Routes

### Auth (copy from ALVer)
```
GET  /api/auth/offer
POST /api/auth/login
GET  /api/auth/sessions/:id        SSE for desktop QR flow
GET  /api/me                       own Person record + community memberships
```

### Person (self)
```
PATCH /api/me                      first_name, last_name, email, phone, bio, avatar_url
PATCH /api/communities/:cid/me/availability    set own availability in this community
```

### Communities
```
GET    /api/communities             my communities (from CommunityMembership)
POST   /api/communities             create new — auto-join as admin
GET    /api/communities/:id         full community with workgroups + members
PATCH  /api/communities/:id         admin: name, slug, branding
```

### Community Members
```
GET    /api/communities/:id/members
POST   /api/communities/:id/members         admin: add by name+email (creates shell Person)
PATCH  /api/communities/:id/members/:pid    admin: is_admin, is_aspirant, joined_at
DELETE /api/communities/:id/members/:pid
PATCH  /api/communities/:id/members/:pid/availability    admin: set availability for others
GET    /api/communities/:id/members/:pid/availability-log    admin only
```

### Availability Types
```
GET    /api/communities/:id/availability-types
POST   /api/communities/:id/availability-types           admin
PATCH  /api/communities/:id/availability-types/:tid      admin
DELETE /api/communities/:id/availability-types/:tid      admin (soft-delete)
```

### Workgroups
```
GET    /api/communities/:id/workgroups      returns workgroups + roles + members in one call
POST   /api/communities/:id/workgroups
PATCH  /api/communities/:id/workgroups/:wid
DELETE /api/communities/:id/workgroups/:wid
```

### Roles
```
POST   /api/workgroups/:wid/roles
PATCH  /api/workgroups/:wid/roles/:rid
DELETE /api/workgroups/:wid/roles/:rid
```

### Workgroup Membership
```
POST   /api/workgroups/:wid/members                     add person to workgroup
PATCH  /api/workgroups/:wid/members/:pid                is_workgroup_admin
DELETE /api/workgroups/:wid/members/:pid
POST   /api/workgroups/:wid/members/:pid/roles          assign role to member
DELETE /api/workgroups/:wid/members/:pid/roles/:rid
```

---

## 5. Frontend Views

### Navigation
Sidebar layout (same as ALVer):
- Community switcher at top — dropdown if member of multiple communities
- **Organogram** (default)
- **Members**
- **My profile**
- **Admin** (visible only to community admins + workgroup admins)

### Organogram view
The showpiece. Two sub-views toggled by a button:

**Card Grid** (default):
- CSS grid of workgroup cards — each has colored top border (workgroup color)
- Members listed inside: first name + colored dot per role (grey = plain member)
- Unavailable members: greyed out, availability emoji + reason on hover
- Aspirants: dashed border or small badge
- Filter bar: by workgroup, by role, toggle hide unavailable
- "Save as PNG" → `html2canvas` → downloads image

**Radial**:
- Pure SVG rendered by React — no graph library
- Community name at center circle
- Workgroups evenly spaced on outer ring (360° / N)
- Members on spokes between center and workgroup, colored by primary role
- Pan + zoom via `react-zoom-pan-pinch`
- Filter bar: same as card grid
- "Save as SVG" → direct SVG download

### Members table
- Sortable columns: Name, Workgroups, Roles, Availability, Joined
- Aspirant badge in Name column
- Availability shown with emoji + reason tooltip
- Click row → Person profile modal
- Search by name

### Person profile modal
- Avatar, name, email, phone, bio
- All workgroup memberships with roles
- Current availability (type emoji + reason + until date)
- Edit button: own profile (always) or any profile (admin only)

### My profile
- Edit: first_name, last_name, email, phone, bio, avatar (upload → base64)
- Set availability: dropdown of community's AvailabilityTypes, optional reason + until date
  - Same type: updates reason/until, `from` stays unchanged
  - Different type: logs old, starts new with `from = today`
  - Clear: logs current, nulls out status

### Admin panel — three tabs

**Community tab:**
- Name, slug, description
- Branding: logo upload, primary color picker, title font selector
- Availability types: list with emoji + name, reorder, add, archive

**Members tab:**
- Table: name, email, is_admin toggle, is_aspirant toggle, joined_at date picker
- Add member: name + email → creates shell Person (no `ename`), links to community. When they log in via ePassport: if a Person with that `ename` already exists → use it; else find a shell Person with matching email → set `ename` on it (link). If no email match → create new Person with `ename` only, admin manually merges.
- Remove member (with confirmation)

**Workgroups tab:**
- List of workgroups with color swatches, drag to reorder
- Expand workgroup inline: manage roles (add/edit/delete), manage members (add/remove, assign roles, toggle workgroup admin)

### Onboarding screen
Shown when Person has no CommunityMemberships. Warm, welcoming tone:
- "Welcome to CORE"
- Brief explanation of what CORE does
- "Your community admin needs to add you. Share your eName with them:"
- Displays `@your-ename` in a copyable code block
- Link to documentation / contact

---

## 6. Organogram Technical Design

### Card Grid
Pure React + CSS — no library.
- Responsive grid: `grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))`
- Workgroup card: white card, 3px colored top border, member list
- Member row: `●` dot colored by first role (or `#E8DDD0` for plain), first name, role name small text
- Unavailable: `opacity: 0.45`, availability emoji next to name, tooltip with reason + until
- Aspirant: dashed border on member row
- Export: `html2canvas(cardGridRef.current)` → `a.download = 'organogram.png'`

### Radial View
Pure SVG, React renders it declaratively.

**Position calculation:**
```
workgroupAngle(i) = (2π / N) * i - π/2    // start at top
workgroupX(i) = cx + R_wg * cos(angle)
workgroupY(i) = cy + R_wg * sin(angle)

// Members on spoke between center and workgroup
memberX(i, j, total) = cx + (R_wg * (j+1) / (total+1)) * cos(angle)
memberY(i, j, total) = cy + (R_wg * (j+1) / (total+1)) * sin(angle)
```

**SVG elements:**
- `<line>` spokes: center → workgroup
- `<rect>` workgroup nodes: white fill, colored stroke (workgroup color)
- `<circle>` person nodes: filled with primary role color (or sand for plain member)
- `<text>` first name below circle, `<text>` workgroup name in rect
- Unavailable: circle `opacity: 0.4`, emoji overlay

**Interactivity:**
- `react-zoom-pan-pinch` wraps the `<svg>` — pinch/scroll to zoom, drag to pan
- Click person circle → open Person profile modal
- Export: `svgRef.current.outerHTML` → Blob → `a.download = 'organogram.svg'`

---

## 7. Availability Logic

When `PATCH /api/communities/:cid/me/availability` is called:

```
currentMembership = load CommunityMembership with availability fields

if payload.clear:
  if currentMembership.availability_type_id:
    write AvailabilityLog(snapshot of current, until_date = today)
  clear availability fields on membership

else if payload.type_id == currentMembership.availability_type_id:
  // Same type — extend
  update availability_reason, availability_until only
  availability_from stays unchanged

else:
  // New type
  if currentMembership.availability_type_id:
    write AvailabilityLog(snapshot of current, until_date = today)
  set availability_type_id = payload.type_id
  set availability_reason = payload.reason
  set availability_from = today  // auto, not from payload
  set availability_until = payload.until
```

---

## 8. W3DS Integration (Phase 2 stubs)

Phase 1: auth works (real W3DS ePassport), sync is no-op.

**What to stub:**
- `api/src/web3adapter/subscriber.ts` — register with TypeORM DataSource but `handleChange` calls are commented out or return immediately
- `api/src/web3adapter/mappings/` — empty JSON stubs: `community.mapping.json`, `person.mapping.json`
- `Person.ename` and `Community.ename` fields exist in DB — ready for sync

**Phase 2 plan (out of scope for this spec):**
- Community → GroupManifest (schema `a8bfb7cf-3200-4b25-9ea9-ee41100f212e`)
- Person → User profile (schema `550e8400-e29b-41d4-a716-446655440000`)
- ALVer subscribes to CORE community eVaults via webhook to sync member list

---

## 9. Deployment

Same pattern as ALVer:

**docker-compose.yml** (dev):
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
```

**Dockerfile** (prod):
- Stage 1: build api (`tsc`)
- Stage 2: build app (`vite build`)
- Stage 3: copy both into slim Node image, serve React static from Express

**Required env vars:**
```env
# API
DB_HOST=postgres
DB_PORT=5432
DB_USER=core
DB_PASSWORD=core
DB_NAME=core
JWT_SECRET=...
PUBLIC_REGISTRY_URL=https://registry.w3ds.metastate.foundation
CORE_MAPPING_DB_PATH=/app/data

# App (Vite)
VITE_PUBLIC_CORE_BASE_URL=https://core.yourdomain.com
```

---

## 10. Implementation Phases

**Phase 1 (this spec):** Working DB app — auth, communities, members, workgroups, roles, availability, organogram, table view. W3DS sync stubbed.

**Phase 2:** Wire up W3DS eVault sync — Person profile → eVault, Community → GroupManifest. Remove community management from ALVer. ALVer subscribes to CORE via webhook.

**Phase 3 (future ideas):** Tenure calculations, automatic aspirant → member promotion, anniversary notifications, availability statistics, member directory export (PDF).
