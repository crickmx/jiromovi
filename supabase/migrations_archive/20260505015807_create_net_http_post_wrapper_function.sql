/*
  # Create net.http_post wrapper for self-chaining edge functions

  1. New Function
    - `net_http_post_wrapper(target_url, headers_json, body_json)` 
    - Calls net.http_post to fire an async HTTP request from the database
    - Used by edge functions to reliably self-chain without dropped requests

  2. Notes
    - pg_net processes requests asynchronously after the transaction commits
    - This guarantees the chained call fires even after the edge function returns
*/

CREATE OR REPLACE FUNCTION public.net_http_post_wrapper(
  target_url text,
  headers_json text DEFAULT '{}',
  body_json text DEFAULT '{}'
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
  request_id bigint;
BEGIN
  SELECT net.http_post(
    url := target_url,
    headers := headers_json::jsonb,
    body := body_json::jsonb
  ) INTO request_id;
  
  RETURN request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.net_http_post_wrapper TO service_role;
