-- Add CHECK constraints for data validation on saved_ean_bases table
-- This ensures server-side validation regardless of how data is submitted

-- Constraint for cnpj_prefix: must be exactly 5 digits
ALTER TABLE public.saved_ean_bases 
ADD CONSTRAINT cnpj_prefix_format 
CHECK (cnpj_prefix ~ '^[0-9]{5}$');

-- Constraint for last_base_code: must be exactly 12 digits
ALTER TABLE public.saved_ean_bases 
ADD CONSTRAINT last_base_code_format 
CHECK (last_base_code ~ '^[0-9]{12}$');

-- Constraint for name: must not be empty and have reasonable length
ALTER TABLE public.saved_ean_bases 
ADD CONSTRAINT name_not_empty 
CHECK (length(trim(name)) > 0 AND length(name) <= 100);