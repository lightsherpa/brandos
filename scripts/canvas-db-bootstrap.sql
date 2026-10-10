-- Minimal dependencies for the canvas migration. Use a NEW, empty local PostgreSQL database only.
-- The permission stub simulates tenant claims; application authorization is tested separately in Node.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create table auth.users(id uuid primary key);
create table public.workspaces(id uuid primary key);
create table public.brands(id uuid primary key,workspace_id uuid references workspaces(id));
create table public.briefs(id uuid primary key,brand_id uuid references brands(id));
create table public.runs(id uuid primary key,brief_id uuid references briefs(id),status text,started_at timestamptz);
create function public.current_user_has_permission(text,uuid) returns boolean language sql stable as $$ select $2::text=current_setting('test.workspace',true) $$;
grant usage on schema public to authenticated,service_role;
