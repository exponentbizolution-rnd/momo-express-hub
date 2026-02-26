
-- Organizations table
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  daily_limit NUMERIC NOT NULL DEFAULT 50000000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Public read for now (no auth yet)
CREATE POLICY "Public read organizations" ON public.organizations FOR SELECT USING (true);

-- Batches table
CREATE TABLE public.batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  file_name TEXT,
  total_records INTEGER NOT NULL DEFAULT 0,
  valid_records INTEGER NOT NULL DEFAULT 0,
  error_records INTEGER NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'processing', 'completed', 'partially_completed', 'failed', 'cancelled')),
  initiated_by TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  organization_id UUID REFERENCES public.organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read batches" ON public.batches FOR SELECT USING (true);
CREATE POLICY "Public insert batches" ON public.batches FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update batches" ON public.batches FOR UPDATE USING (true);

-- Transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  row_number INTEGER,
  recipient_name TEXT NOT NULL,
  mobile_number TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 1 AND amount <= 50000),
  reference TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'success', 'failed', 'retrying')),
  mtn_transaction_id TEXT,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read transactions" ON public.transactions FOR SELECT USING (true);
CREATE POLICY "Public insert transactions" ON public.transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update transactions" ON public.transactions FOR UPDATE USING (true);

-- Audit log table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('upload', 'approve', 'reject', 'submit', 'config', 'download', 'system', 'login', 'logout')),
  user_name TEXT,
  user_role TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read audit_logs" ON public.audit_logs FOR SELECT USING (true);
CREATE POLICY "Public insert audit_logs" ON public.audit_logs FOR INSERT WITH CHECK (true);

-- Auto-generate batch numbers
CREATE OR REPLACE FUNCTION public.generate_batch_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(batch_number FROM 3) AS INTEGER)), 2840) + 1
  INTO next_num
  FROM public.batches;
  
  NEW.batch_number := 'B-' || next_num;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_batch_number
  BEFORE INSERT ON public.batches
  FOR EACH ROW
  WHEN (NEW.batch_number IS NULL OR NEW.batch_number = '')
  EXECUTE FUNCTION public.generate_batch_number();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_batches_updated_at
  BEFORE UPDATE ON public.batches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Enable realtime for batches and transactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.batches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;

-- Seed a default organization
INSERT INTO public.organizations (name, daily_limit) VALUES ('ExpoPay Default', 15000000);
