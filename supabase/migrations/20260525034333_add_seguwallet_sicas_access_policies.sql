/*
  # Add Seguwallet customer access to SICAS data

  ## Summary
  Seguwallet customers need to read their own policies and documents from sicas_documents
  and sicas_digital_files tables. Previously no policy existed for non-MOVI users on
  these tables, so Seguwallet customers got 0 rows.

  ## New Policies
  - `sicas_documents`: SELECT policy for Seguwallet customers based on their assigned
    client names stored in seguwallet_customer_sicas_clients
  - `sicas_digital_files`: Same pattern for digital documents/receipts

  ## Security
  - Customers can ONLY see documents where `cliente` matches their assigned SICAS clients
  - Uses `get_seguwallet_customer_id()` helper to resolve auth.uid() -> customer id
  - Completely isolated from MOVI user policies
*/

-- Policy: seguwallet customers can read their assigned clients' documents
CREATE POLICY "seguwallet_customer_sicas_docs_select"
  ON sicas_documents
  FOR SELECT
  TO authenticated
  USING (
    is_seguwallet_customer(auth.uid())
    AND cliente IN (
      SELECT sicas_client_id
      FROM seguwallet_customer_sicas_clients
      WHERE seguwallet_customer_id = get_seguwallet_customer_id(auth.uid())
    )
  );

-- Policy: seguwallet customers can read their assigned clients' digital files
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'sicas_digital_files' AND table_schema = 'public'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "seguwallet_customer_sicas_files_select"
        ON sicas_digital_files
        FOR SELECT
        TO authenticated
        USING (
          is_seguwallet_customer(auth.uid())
          AND cliente IN (
            SELECT sicas_client_id
            FROM seguwallet_customer_sicas_clients
            WHERE seguwallet_customer_id = get_seguwallet_customer_id(auth.uid())
          )
        )
    $policy$;
  END IF;
END $$;
