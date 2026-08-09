# Deployment Guide — Phase 2.5 Week 1

## Production Independence: Vercel + Expo Web

This guide covers deploying DiabetealaBurger to Vercel for patient access without ngrok tunnel.

### Prerequisites

1. **Node.js 18+** and **npm/yarn** installed
2. **Vercel CLI**: `npm install -g vercel`
3. **Vercel account**: https://vercel.com/signup
4. **Supabase project** already set up with:
   - `glucose_readings` table
   - `insulin_events` table
   - `app_logs` table
   - `sync_logs` table
   - Row-level security (RLS) policies

### Step 1: Prepare Expo Web

```bash
cd /Users/re/DiabetealaBurger

# Install Expo Web support
npm install expo-cli

# Build web bundle
npx expo export --platform web

# This generates dist/ directory with static files
```

### Step 2: Create vercel.json

Create `vercel.json` in project root:

```json
{
  "buildCommand": "npm run build",
  "installCommand": "npm install",
  "outputDirectory": "dist",
  "env": {
    "SUPABASE_URL": "@supabase_url",
    "SUPABASE_ANON_KEY": "@supabase_anon_key",
    "ENVIRONMENT": "production"
  }
}
```

### Step 3: Configure Environment Variables

1. Create `.env.production` locally:
   ```
   SUPABASE_URL=https://[your-project].supabase.co
   SUPABASE_ANON_KEY=[your-anon-key]
   ENVIRONMENT=production
   ```

2. Add to Vercel dashboard:
   - Go to Project Settings → Environment Variables
   - Add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ENVIRONMENT`

### Step 4: Configure Supabase

1. **Auth → URL Configuration**:
   - Add `https://[your-vercel-domain].vercel.app` to Redirect URLs
   - Add `https://[your-vercel-domain].vercel.app/` (with trailing slash)

2. **RLS Policies** (if not already set):
   ```sql
   -- Patients can only see their own data
   CREATE POLICY "Users see only own glucose" ON glucose_readings
     FOR SELECT USING (auth.uid()::text = patient_id);

   -- Similar for other tables
   ```

### Step 5: Deploy to Vercel

```bash
# Login to Vercel
vercel login

# Deploy
vercel --prod

# This will:
# 1. Build dist/ from source
# 2. Deploy to Vercel infrastructure
# 3. Configure environment variables
# 4. Provide production URL
```

### Step 6: Verify Deployment

1. **Check app loads**:
   - Visit `https://[your-project].vercel.app`
   - Verify patient can see glucose readings
   - Verify patient can navigate tabs

2. **Check logs**:
   - Vercel dashboard → Deployments → Logs
   - Supabase dashboard → Logs → API Requests (verify auth working)

3. **Check sync**:
   - In Supabase: SELECT * FROM app_logs ORDER BY timestamp DESC LIMIT 5
   - Verify `health_sync_started` and `health_sync_completed` events exist

### Health Data Sync Configuration

Background sync runs every 15 minutes. To enable actual data sync:

1. **Freestyle API**:
   - Set `FREESTYLE_API_URL` and `FREESTYLE_API_TOKEN` in Vercel environment
   - Or implement OAuth flow for patient to authorize

2. **Ultrahuman API**:
   - Set `ULTRAHUMAN_API_URL` and `ULTRAHUMAN_API_TOKEN` in Vercel environment
   - Or implement OAuth flow

### Monitoring (Admin Dashboard)

Query Supabase to monitor patient activity:

```sql
-- Last sync times
SELECT 
  event,
  timestamp,
  metadata
FROM app_logs
WHERE patient_id = '1'
ORDER BY timestamp DESC
LIMIT 20;

-- Health data coverage
SELECT 
  DATE(timestamp) as date,
  COUNT(*) as reading_count,
  MIN(value) as min_glucose,
  MAX(value) as max_glucose,
  AVG(value) as avg_glucose
FROM glucose_readings
WHERE patient_id = '1'
GROUP BY DATE(timestamp)
ORDER BY date DESC;
```

### Troubleshooting

**Issue**: Patient can't login
- Check: Auth → URL Configuration has correct Redirect URLs
- Check: SUPABASE_ANON_KEY is correct in Vercel env vars

**Issue**: Glucose readings not syncing
- Check: Freestyle/Ultrahuman credentials in env vars
- Check: App logs show sync errors: `SELECT * FROM app_logs WHERE event LIKE '%error%'`

**Issue**: Slow page loads
- Check: Vercel Analytics in dashboard
- Optimize: Image sizes, bundle splitting, cache headers

### Rollback

If deployment fails, rollback to previous version:

```bash
vercel rollback --token [your-token]
```

Or redeploy from Vercel dashboard → Deployments → [Previous] → Redeploy

### CI/CD (Optional)

For automated deployments on every git push:

1. Connect GitHub repository to Vercel
2. Vercel will auto-deploy on push to `main`
3. Each PR gets a preview deployment

---

## Next: Week 2 - Diagnosis Engine Audit

After verifying Week 1 is complete:
- Patient accesses app at production URL ✅
- Patient sees health data syncing ✅
- Logs show activity ✅

Begin Week 2: Run intensive user testing to diagnose which part of the closed-loop cycle needs fixing.
