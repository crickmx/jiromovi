/*
  # Convert custom_text from text[] to text
  
  1. Changes
    - Drop the max_five_paragraphs constraint that checks array length
    - Convert custom_text column from text[] to text
    - Existing arrays will be joined with double newlines between elements
*/

-- Drop the array length constraint
ALTER TABLE user_web_pages 
DROP CONSTRAINT IF EXISTS max_five_paragraphs;

-- Convert column from text[] to text
-- Join array elements with double newlines
ALTER TABLE user_web_pages 
ALTER COLUMN custom_text TYPE text 
USING CASE 
  WHEN custom_text IS NULL THEN ''
  WHEN array_length(custom_text, 1) IS NULL THEN ''
  ELSE array_to_string(custom_text, E'\n\n')
END;
