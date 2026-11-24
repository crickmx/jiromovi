/*
  # Fix Usuarios RLS for Service Role Access

  1. Changes
    - Remove duplicate and conflicting SELECT policies
    - Ensure service_role has unrestricted access
    - Keep only essential policies for authenticated users
    - Simplify policy structure to avoid conflicts

  2. Security
    - Service role can read all users (for edge functions)
    - Authenticated users can read active users
    - Users can update their own profile
    - Public users can see published web profiles
*/

-- Drop all existing SELECT policies to start clean
drop policy if exists "Active users view each other" on usuarios;
drop policy if exists "Public view published profiles" on usuarios;
drop policy if exists "Service role can read all users" on usuarios;
drop policy if exists "Service role full access" on usuarios;
drop policy if exists "Users view own profile" on usuarios;
drop policy if exists "Usuarios: authenticated can read basic info" on usuarios;

-- Create simplified SELECT policies

-- 1. Service role has unrestricted access (for edge functions)
create policy "Service role: read all"
on usuarios
for select
to service_role
using (true);

-- 2. Authenticated users can read active, non-deleted users
create policy "Authenticated: read active users"
on usuarios
for select
to authenticated
using (
  estado = 'activo' 
  and (is_deleted = false or is_deleted is null)
);

-- 3. Anonymous users can read published web profiles
create policy "Anonymous: read published profiles"
on usuarios
for select
to anon
using (
  estado = 'activo'
  and web_slug is not null
  and exists (
    select 1 from user_web_pages
    where user_web_pages.user_id = usuarios.id
    and user_web_pages.is_published = true
  )
);

-- Keep UPDATE policy as is
drop policy if exists "Users can update own profile" on usuarios;

create policy "Users: update own profile"
on usuarios
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Keep INSERT policy for service role
drop policy if exists "Service role can insert users" on usuarios;

create policy "Service role: insert users"
on usuarios
for insert
to service_role
with check (true);