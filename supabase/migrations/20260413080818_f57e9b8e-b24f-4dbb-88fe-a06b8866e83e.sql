-- Fix mutable search_path on generate_batch_number
CREATE OR REPLACE FUNCTION public.generate_batch_number()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(
    MAX(
      CASE 
        WHEN batch_number ~ '^B-[0-9]+$' 
        THEN CAST(SUBSTRING(batch_number FROM 3) AS INTEGER)
        ELSE NULL
      END
    ), 
    2840
  ) + 1
  INTO next_num
  FROM public.batches;
  
  NEW.batch_number := 'B-' || next_num;
  RETURN NEW;
END;
$function$;

-- Fix mutable search_path on update_updated_at  
CREATE OR REPLACE FUNCTION public.update_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Tighten system_settings SELECT to super_admin only
DROP POLICY IF EXISTS "Authenticated can read settings" ON public.system_settings;
CREATE POLICY "Admins can read settings"
  ON public.system_settings FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));