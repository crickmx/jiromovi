CREATE POLICY "Service role manages agenda reminders"
ON public.agenda_booking_reminders
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
