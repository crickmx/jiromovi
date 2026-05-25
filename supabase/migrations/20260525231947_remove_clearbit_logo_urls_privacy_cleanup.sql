/*
  # Privacy Cleanup: Remove Clearbit External Logo URLs

  ## Summary
  Brave and other privacy-focused browsers detect requests to logo.clearbit.com as
  trackers/ads and block them. This migration eliminates all Clearbit dependencies
  from the seguwallet_insurers table.

  ## Changes

  ### seguwallet_insurers table
  - For insurers WITH a local logo (logo_local_path IS NOT NULL):
    Moves clearbit URL to logo_original_source_url (for admin reference) then nulls logo_url
  - For insurers WITHOUT a local logo:
    Moves clearbit URL to logo_original_source_url (preserves origin for future import)
    Nulls logo_url so no external request is made

  ## Security
  - No data deleted — clearbit URLs preserved in logo_original_source_url for admin use
  - getInsurerLogoUrl() already prefers logo_local_path over logo_url
  - Insurers without local logos will show initials fallback until admin uploads a logo

  ## Affected rows
  All rows where logo_url ILIKE '%clearbit.com%'
*/

-- Step 1: Preserve clearbit URLs in logo_original_source_url before clearing
UPDATE seguwallet_insurers
SET logo_original_source_url = logo_url
WHERE logo_url ILIKE '%clearbit.com%'
  AND (logo_original_source_url IS NULL OR logo_original_source_url = '');

-- Step 2: Null out all clearbit logo_url values
-- getInsurerLogoUrl() will use logo_local_path first, then fallback to initials
UPDATE seguwallet_insurers
SET logo_url = NULL
WHERE logo_url ILIKE '%clearbit.com%';
