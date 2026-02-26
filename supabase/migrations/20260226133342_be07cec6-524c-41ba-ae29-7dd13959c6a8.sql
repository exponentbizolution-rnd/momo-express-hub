-- Add column to store raw CSV content in batches table
ALTER TABLE public.batches ADD COLUMN csv_content text;