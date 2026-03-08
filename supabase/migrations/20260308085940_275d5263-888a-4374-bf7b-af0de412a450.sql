-- Fix transactions status check: replace 'success' with 'completed', add 'partially_completed'
ALTER TABLE public.transactions DROP CONSTRAINT transactions_status_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_status_check 
  CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'retrying'::text, 'partially_completed'::text]));

-- Fix audit_logs action_type check: add 'disburse'
ALTER TABLE public.audit_logs DROP CONSTRAINT audit_logs_action_type_check;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_action_type_check 
  CHECK (action_type = ANY (ARRAY['upload'::text, 'approve'::text, 'reject'::text, 'submit'::text, 'config'::text, 'download'::text, 'system'::text, 'login'::text, 'logout'::text, 'disburse'::text]));