-- Terminate any impersonation sessions that have been active for more than 24 hours
UPDATE admin_impersonation_sessions 
SET status = 'ended', ended_at = now() 
WHERE status = 'active' 
AND started_at < now() - interval '24 hours';
