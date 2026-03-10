CREATE OR REPLACE FUNCTION public.generate_batch_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
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
$$;