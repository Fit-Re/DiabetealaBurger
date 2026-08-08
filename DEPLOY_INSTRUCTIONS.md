# 🚀 Deploy Knowledge Neural Network to Supabase

**Status**: Ready to deploy 48 papers + 50+ relationships  
**Time**: ~10 minutes  
**Method**: Supabase Dashboard SQL Editor  

---

## 📋 Step-by-Step Deployment

### Step 1: Open Supabase Dashboard

1. Go to: https://app.supabase.com
2. Select project: **DiabeteaBurger's Project** (us-east-1)
3. Click: **SQL Editor** (left sidebar)

---

### Step 2: Execute Migration 1 (Create Tables)

**File**: `supabase/migrations/add_paper_relationships.sql`

1. Copy the content of this file:
   ```
   /Users/re/DiabetealaBurger/supabase/migrations/add_paper_relationships.sql
   ```

2. In Supabase SQL Editor, click **"New Query"**

3. Paste the SQL code

4. Click **"RUN"** (or Cmd+Enter)

5. Wait for completion. You should see:
   ```
   ✓ CREATE TABLE
   ✓ CREATE INDEX
   ✓ CREATE VIEW
   ```

---

### Step 3: Execute Migration 2 (Load 48 Papers)

**File**: `supabase/migrations/load_48_papers.sql`

1. Click **"New Query"** again

2. Copy & paste content from:
   ```
   /Users/re/DiabetealaBurger/supabase/migrations/load_48_papers.sql
   ```

3. Click **"RUN"**

4. You should see:
   ```
   INSERT 0 48
   ```
   (48 papers inserted)

---

### Step 4: Execute Migration 3 (Load Relationships)

**File**: `supabase/migrations/load_paper_relationships.sql`

1. Click **"New Query"**

2. Copy & paste content from:
   ```
   /Users/re/DiabetealaBurger/supabase/migrations/load_paper_relationships.sql
   ```

3. Click **"RUN"**

4. You should see:
   ```
   INSERT 0 50+
   ```
   (50+ relationships inserted)

---

### Step 5: Verify Deployment

Run these quick checks in SQL Editor:

**Check 1: Papers loaded**
```sql
SELECT COUNT(*) as paper_count FROM knowledge_chunks WHERE curated = true;
```
Expected: `48`

**Check 2: Relationships loaded**
```sql
SELECT COUNT(*) as relationship_count FROM paper_relationships;
```
Expected: `50+` (actually ~100 with bidirectional edges)

**Check 3: Graph statistics**
```sql
SELECT * FROM graph_statistics;
```
Expected: 48 papers, 100+ edges, avg_weight ~0.75

**Check 4: Sample neighbor query**
```sql
SELECT * FROM paper_neighbors WHERE source_paper_id = 'dekker-2024-minimed780g' LIMIT 5;
```
Expected: 3-5 connected papers

---

## ✅ Deployment Checklist

- [ ] Step 1: Opened Supabase Dashboard
- [ ] Step 2: Created paper_relationships table (migration 1)
- [ ] Step 3: Loaded 48 papers (migration 2)
- [ ] Step 4: Loaded 50+ relationships (migration 3)
- [ ] Step 5: Verified all 4 checks passed

---

## 🧪 Next: Test with Real Data

Once deployment is complete:

```bash
cd /Users/re/DiabetealaBurger

# Initialize graph + test with real patient
npx ts-node scripts/test_with_real_patient.ts
```

This will:
1. Load graph from Supabase (real data)
2. Simulate 1 patient with nocturnal hypo pattern
3. Show activation paths + confidence scores
4. Verify decay factor + multi-hop propagation

---

## 🔗 Resources

- Supabase Project: https://app.supabase.com (DiabeteaBurger's Project)
- Migrations: `/supabase/migrations/`
- Graph class: `/src/lib/knowledgeGraph.ts`
- Integration: `/src/lib/knowledgeBase.ts`

---

## 💡 Troubleshooting

**Problem**: "Table already exists" error  
**Solution**: This is OK - migrations have conflict handling (ON CONFLICT DO NOTHING). Just click RUN again.

**Problem**: "Foreign key constraint" error  
**Solution**: Check that `knowledge_chunks` table exists (migration 2 depends on it existing).

**Problem**: "Permission denied" error  
**Solution**: Make sure you're logged into Supabase with correct project selected.

---

**Estimated time**: 5-10 minutes  
**Complexity**: Low (copy-paste SQL)  
**Risk**: None (ON CONFLICT prevents duplicates)

Let me know when you're done with all 5 steps! 🚀
