/*
  # Add DELETE policy for ticket-archivos storage bucket

  1. Problem
    - The ticket-archivos bucket has SELECT and INSERT policies but no DELETE policy
    - Users cannot remove their uploaded attachments from storage

  2. Solution
    - Add a DELETE policy allowing authenticated users to delete files from ticket-archivos
*/

CREATE POLICY "Authenticated users can delete ticket archivos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ticket-archivos');