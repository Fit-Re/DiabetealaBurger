# DiabetealaBurger Architecture & System Design

## Overview

DiabetealaBurger is a diabetes self-management app that synthesizes evidence, provides personalized insights, and tracks lifestyle factors. This document describes the system architecture, data flows, entity relationships, authentication, and knowledge graph that power the app.

**Tech Stack:**
- **Frontend**: React Native + Expo (iOS/Android)
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **AI/ML**: Google Gemini (embeddings + semantic search)
- **Auth**: Supabase Auth + Google OAuth
- **State**: Zustand (client-side)

---

## 1. System Architecture

**Components:**
- **React Native App** (Expo): Mobile frontend with bottom-tab navigation
  - HomeScreen (glucose dashboard + patterns)
  - TrendsScreen (analytics + compliance)
  - EvidenceScreen (research papers + relevance)
  - SettingsScreen (profile + integrations)

- **Zustand Store**: Client-side state management
  - Readings, insulin events, patterns, user profile
  - Theme, onboarding, session

- **Supabase Platform**: Backend infrastructure
  - PostgreSQL database with Row-Level Security (RLS)
  - Authentication service (Google OAuth, JWT)
  - Edge Functions (serverless: sync, embedding, ML)
  - Realtime subscriptions for live updates

**Data Flow:**
User → React Native App → Zustand Store → Supabase Client → Supabase Platform

**Location:** [`diagrams/system-architecture.mmd`](diagrams/system-architecture.mmd)

---

## 2. Data Flow Pipeline

**Sources → Ingestion → Processing → Display**

### Data Sources
1. **LibreLink CGM** (FreeStyle Libre continuous glucose monitor)
   - Real-time glucose readings via API
   - ~15-minute intervals

2. **Ultrahuman Ring** (wearable health tracker)
   - Heart rate variability, sleep quality, stress levels
   - Daily aggregate + intraday granular

3. **Dexcom CGM** (alternative glucose monitor)
   - Real-time + historical readings
   - Alarm events

4. **Manual Entry** (user input)
   - One-off readings, meals, exercise notes
   - Insulin injection records

### Ingestion Pipeline (Edge Function)
```
CGM/Wearable API → Validate & Normalize → Supabase readings table
                                       ↓
                              Trigger: New Reading Event
```

### Processing Layers

**Layer 1: Pattern Detection** (Edge Function or background job)
- Detect meal timing patterns (e.g., high glucose consistently 2 hours post-breakfast)
- Exercise correlation (e.g., 30-min run → ↓ glucose 1 hour later)
- Stress impact (cortisol patterns)
- Sleep effect on fasting glucose

**Layer 2: Embedding & Knowledge Graph** (Gemini)
- Convert each patient pattern to semantic embedding
- Query embedding index of research papers
- Find papers with high cosine similarity to user's pattern
- Generate relevance score (0-1)

**Layer 3: Aggregation** (SQL views or app-side)
- Compute statistics (average, time-in-range, stability)
- Aggregate trends (7d, 30d view)
- Build correlation matrix (meals ↔ glucose, sleep ↔ fasting, etc.)

### Output Displays
- **HomeScreen**: Current reading + summary + patterns + insulin timeline
- **TrendsScreen**: 7d/30d charts + stat cards + compliance tracking
- **EvidenceScreen**: Ranked research papers + relevance bars + citations

**Location:** [`diagrams/data-flow.mmd`](diagrams/data-flow.mmd)

---

## 3. Entity-Relationship Model

### Core Entities

**Patients** (`patients` table)
- `id` (UUID, PK)
- `user_id` (FK to auth.users)
- `name`, `email`
- `diabetes_type` (T1D, T2D, gestational, other)
- `glucose_range` {min, max} (70-180 mg/dL by default)
- `weight`, `height`, `insulin_type`
- `created_at`, `updated_at`

**Glucose Readings** (`readings` table)
- `id` (UUID, PK)
- `patient_id` (FK)
- `timestamp`
- `value` (glucose mg/dL or mmol/L)
- `unit`
- `source` (CGM, meter, manual)
- `confidence` (0-1, from CGM)
- Indexes: (patient_id, timestamp DESC), (patient_id, value)

**Insulin Events** (`insulin_events` table)
- `id` (UUID, PK)
- `patient_id` (FK)
- `timestamp`
- `type` (bolus, basal)
- `dosage` (units)
- `notes` (free text)

**Detected Patterns** (`patterns` table)
- `id` (UUID, PK)
- `patient_id` (FK)
- `description` (e.g., "Morning high glucose")
- `time_period` (e.g., "6am-9am daily")
- `affected_readings_count`
- `confidence` (0-1)
- `detected_at`

**Research Papers** (`evidence` table)
- `id` (UUID, PK)
- `title`, `authors`, `journal`, `year`
- `evidence_strength` (high, medium, low)
- `doi`, `url`, `abstract`
- `citation_count`

**Embeddings** (`embeddings` table)
- `id` (UUID, PK)
- `evidence_id` (FK)
- `vector` (pgvector, 1536-dim Gemini embedding)
- `relevance_score` (computed during search)
- Index: HNSW vector index for similarity search

**Pattern-Evidence Links** (`pattern_evidence_links` table)
- `id` (UUID, PK)
- `pattern_id` (FK)
- `evidence_id` (FK)
- `match_strength` (cosine similarity score)
- `created_at`

### Relationships
- Patient has-many Readings
- Patient has-many Insulin Events
- Patient has-many Patterns
- Evidence has-one Embedding
- Pattern has-many Evidence (via links)

**Location:** [`diagrams/entity-relationship.mmd`](diagrams/entity-relationship.mmd)

---

## 4. Authentication Flow

### Sequence
1. **User initiates login**: Taps "Sign in with Google" in Expo app
2. **Google OAuth flow**: Supabase Auth redirects to Google consent screen
3. **User authorizes**: Grants permission to read email + profile
4. **OAuth callback**: Supabase receives authorization code from Google
5. **Token issued**: Supabase generates JWT (short-lived, 1-hour default)
6. **Session storage**: App stores JWT in AsyncStorage (encrypted on device)
7. **API requests**: All Supabase API calls include JWT in Authorization header
8. **RLS enforcement**: PostgreSQL policies check user_id from JWT

### Security: Row-Level Security (RLS)

Every table has RLS policies:
```sql
-- readings table example
CREATE POLICY "Users can view own readings"
  ON readings
  FOR SELECT
  USING (patient_id = (SELECT id FROM patients WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own readings"
  ON readings
  FOR INSERT
  WITH CHECK (patient_id = (SELECT id FROM patients WHERE user_id = auth.uid()));
```

**Token Refresh**: If JWT expires, app automatically re-authenticates via Google (silent refresh).

**Sign Out**: User action clears AsyncStorage, logs out of Google session.

**Location:** [`diagrams/auth-flow.mmd`](diagrams/auth-flow.mmd)

---

## 5. Knowledge Graph & Evidence Synthesis

### How It Works

**Step 1: User Pattern Detection**
- App detects: "User consistently has high glucose 2 hours after breakfast"
- Pattern is stored with semantic description

**Step 2: Embedding Generation** (Gemini API)
- Patient pattern → text description → Gemini embedding (1536-dim vector)
- Each research paper → abstract + title → embedding
- All stored in `embeddings` table

**Step 3: Semantic Search** (Vector similarity)
- Query: Find papers similar to user's pattern
- Method: Cosine similarity in vector space
- Tool: pgvector HNSW index in PostgreSQL
- Result: Top N papers with similarity scores

**Step 4: Filtering & Ranking**
- Filter by evidence strength (high/medium/low)
- Rank by relevance score + citation count
- Show strength badges + confidence bars

**Step 5: Feedback Loop**
- User rates: "This paper is helpful" 👍
- System adjusts weights → future patterns re-scored
- Continuous improvement

**Step 6: Continuous Update**
- New readings → re-detect patterns
- Re-index embeddings (batch job)
- Re-query knowledge graph
- Users see updated evidence on next refresh

### Example
- **User Pattern**: High morning glucose (detected from 30-day history)
- **Paper 1**: "Meal Timing and Postprandial Glucose Excursions" → 0.92 relevance
- **Paper 2**: "Sleep Quality and Fasting Glucose" → 0.85 relevance
- **Paper 3**: "Stress and Cortisol Effects" → 0.71 relevance
- **Displayed on EvidenceScreen**: Papers ranked 1→2→3, with badges showing evidence strength

**Location:** [`diagrams/knowledge-graph.mmd`](diagrams/knowledge-graph.mmd)

---

## 6. Key Design Decisions

| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
| **React Native + Expo** | Cross-platform (iOS/Android), fast iteration, hot reload | Can't access 100% of native APIs |
| **Supabase** | Managed PostgreSQL, built-in auth, edge functions, RLS | Vendor lock-in, limited customization |
| **Zustand for state** | Lightweight, good for simple stores, no boilerplate | No middleware ecosystem like Redux |
| **Gemini embeddings** | State-of-the-art semantic search, low cost | Requires API calls (latency + cost) |
| **Vector search in PG** | Keeps data in one place, simpler ops | Slower than specialized vector DB (milvus) |
| **Google OAuth only** | Simple, users already have Google accounts | No email/password fallback |
| **RLS for all access** | Database-level security, can't be bypassed | Requires discipline in policy writing |

---

## 7. Deployment & Scaling

### Current (Phase 2)
- **Frontend**: Hosted on Expo Go (dev) or Expo EAS (build service for App Store/Play Store)
- **Backend**: Supabase (single PostgreSQL instance, ~5 concurrent connections per user)
- **ML**: Gemini API (pay-as-you-go)

### Phase 3-4 Considerations
- **Caching**: Redis for embedding cache, pattern cache, user session
- **Async jobs**: Bull queue for embedding generation, pattern detection (avoid blocking API)
- **Analytics**: PostHog or Mixpanel for user behavior tracking
- **Monitoring**: Sentry for error tracking, DataDog for infrastructure
- **CDN**: CloudFlare for static assets (if needed)

---

## 8. Security & Privacy

### At Rest
- Database encryption (Supabase Postgres uses AES-256)
- Secrets in environment variables (never committed)
- User data never leaves database (no exports)

### In Transit
- TLS 1.2+ for all connections
- JWT signed with RS256
- API calls over HTTPS

### Access Control
- RLS policies on every table
- Users can only access own data
- OAuth scopes limited to email + profile

### GDPR Compliance (Future)
- Data export: API endpoint to download all user data
- Right to be forgotten: Cascade delete all patient data on request
- Audit logs: Track who accessed what (not yet implemented)

---

## 9. API Contract (Supabase Realtime + RLS)

### Example: Fetch User's Readings
```typescript
const { data, error } = await supabase
  .from('readings')
  .select('*')
  .eq('patient_id', patientId)
  .order('timestamp', { ascending: false })
  .limit(100);
```
RLS automatically filters to user's patient_id via JWT.

### Example: Insert New Reading
```typescript
const { data, error } = await supabase
  .from('readings')
  .insert([{ patient_id, timestamp, value, source }]);
```
RLS policy checks: is patient_id owned by current user?

### Example: Subscribe to New Patterns
```typescript
const subscription = supabase
  .from('patterns')
  .on('INSERT', (payload) => {
    console.log('New pattern:', payload.new);
  })
  .subscribe();
```
Realtime updates via WebSocket (RLS still enforced).

---

## 10. Roadmap & Future Work

### Q3 2026 (Phase 3: Implementation & Quality)
- [ ] Connect to real LibreLink/Ultrahuman/Dexcom APIs
- [ ] Implement edge functions for sync + embedding
- [ ] User testing with 3-5 Type 1 diabetes patients
- [ ] Performance optimization (caching, indexing)

### Q4 2026 (Phase 4: Deployment & Release)
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] App Store & Play Store submission
- [ ] Launch strategy & user acquisition

### Post-Launch
- [ ] Pattern detection ML model
- [ ] Personalized recommendations
- [ ] Social features (family sharing, community)
- [ ] Integration with doctor portals

---

## 11. For New Developers

Start here:
1. Read this document (you are here ✓)
2. Review [`README.md`](README.md) for setup & dependencies
3. Explore [`src/store.ts`](src/store.ts) — the data model
4. Walk the screens in order: Home → Settings → Evidence → Trends
5. Check [`src/theme.ts`](src/theme.ts) for design tokens
6. Run tests: `npm test`

**Key files:**
- [`App.tsx`](App.tsx) — navigation setup
- [`src/screens/HomeScreen.tsx`](src/screens/HomeScreen.tsx) — main dashboard
- [`src/screens/EvidenceScreen.tsx`](src/screens/EvidenceScreen.tsx) — knowledge graph UI
- [`.claude/plans/quizzical-hatching-cookie.md`](.claude/plans/quizzical-hatching-cookie.md) — design decisions

---

**Generated:** 2026-08-09  
**Diagrams location:** `diagrams/`  
**Questions?** See [CLAUDE.md](CLAUDE.md) for skill routing and contribution guidelines.
