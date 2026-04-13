-- 1. Tighten audit_logs: only super_admin and auditor can read
DROP POLICY IF EXISTS "Authenticated users can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins and auditors can view audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'auditor'::app_role)
  );

DROP POLICY IF EXISTS "Authenticated users can create audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can create audit logs"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- 2. Tighten batches SELECT: only users with a role can view
DROP POLICY IF EXISTS "Authenticated users can view batches" ON public.batches;
CREATE POLICY "Role holders can view batches"
  ON public.batches FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'initiator'::app_role) OR
    has_role(auth.uid(), 'approver'::app_role) OR
    has_role(auth.uid(), 'auditor'::app_role)
  );

-- 3. Tighten transactions SELECT: only users with a role can view
DROP POLICY IF EXISTS "Authenticated users can view transactions" ON public.transactions;
CREATE POLICY "Role holders can view transactions"
  ON public.transactions FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'initiator'::app_role) OR
    has_role(auth.uid(), 'approver'::app_role) OR
    has_role(auth.uid(), 'auditor'::app_role)
  );