/*
  # Fix seguwallet_customer_documents RLS for customer uploads

  The INSERT policy was missing for customers uploading documents to their own expediente.
  Previously only agents could insert documents; this adds the matching customer policy.
  Also adds UPDATE and DELETE for customers on their own documents.
*/

CREATE POLICY "Customers can insert own documents"
  ON seguwallet_customer_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM seguwallet_customers sc
      WHERE sc.id = seguwallet_customer_documents.seguwallet_customer_id
        AND sc.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Customers can update own documents"
  ON seguwallet_customer_documents
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM seguwallet_customers sc
      WHERE sc.id = seguwallet_customer_documents.seguwallet_customer_id
        AND sc.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM seguwallet_customers sc
      WHERE sc.id = seguwallet_customer_documents.seguwallet_customer_id
        AND sc.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Customers can delete own documents"
  ON seguwallet_customer_documents
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM seguwallet_customers sc
      WHERE sc.id = seguwallet_customer_documents.seguwallet_customer_id
        AND sc.auth_user_id = auth.uid()
    )
  );
