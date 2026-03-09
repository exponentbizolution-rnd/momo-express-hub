

## Plan: Persist Environment Setting + Dynamic Currency

### Overview
Store the selected MTN environment in a `system_settings` database table. Add a "Save" button to Settings. Create a shared hook so all pages use the correct currency (EUR for sandbox, ZMW for production).

### Database Change
Create `system_settings` table:
```sql
CREATE TABLE public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
-- All authenticated can read
CREATE POLICY "Authenticated can read settings" ON public.system_settings FOR SELECT TO authenticated USING (true);
-- Only super_admins can update/insert
CREATE POLICY "Super admins can manage settings" ON public.system_settings FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));
```

Seed with default: `INSERT INTO system_settings (key, value) VALUES ('mtn_environment', 'sandbox');`

### New Hook: `src/hooks/useMtnEnvironment.ts`
- Queries `system_settings` where `key = 'mtn_environment'`
- Returns `{ environment, currency, isProduction, isLoading }`
- Currency: `sandbox → EUR`, `production → ZMW`

### Settings.tsx Changes
- Load saved environment on mount via the hook
- Add "Save Environment" button that upserts to `system_settings`
- Show success toast on save
- Disable save when unchanged

### Currency Updates Across App
Replace all hardcoded `"ZMW"` with the currency from `useMtnEnvironment()`:
- **Dashboard.tsx**: `formatAmount()` and transaction table amount column
- **Batches.tsx**: batch total column and balance messages
- **BatchDetail.tsx**: batch header and transaction amount column

### Files to Create/Modify
1. **Migration**: Create `system_settings` table + seed
2. **`src/hooks/useMtnEnvironment.ts`**: New shared hook
3. **`src/pages/Settings.tsx`**: Add save button, load from DB
4. **`src/pages/Dashboard.tsx`**: Use dynamic currency
5. **`src/pages/Batches.tsx`**: Use dynamic currency
6. **`src/pages/BatchDetail.tsx`**: Use dynamic currency

