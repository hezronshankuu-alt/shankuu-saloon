-- Shankuu Salon starter schema for Supabase/Postgres.
-- Run in Supabase SQL Editor. Review before applying to a production project.
create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create table if not exists public.salon_owners (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Shankuu',
  created_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  price_tzs integer not null check (price_tzs > 0),
  duration_minutes integer not null check (duration_minutes between 15 and 600),
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

create type public.booking_status as enum ('pending','confirmed','cancelled','completed');

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_reference text not null unique default (
    'SS-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))
  ),
  service_id uuid not null references public.services(id),
  customer_name text not null check (char_length(customer_name) between 2 and 100),
  customer_phone text not null check (char_length(customer_phone) between 7 and 25),
  appointment_date date not null,
  start_time time not null,
  end_time time not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  price_tzs integer not null check (price_tzs > 0),
  deposit_due_tzs integer not null check (deposit_due_tzs >= 0),
  deposit_paid_tzs integer not null default 0 check (deposit_paid_tzs >= 0),
  status public.booking_status not null default 'pending',
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','pending','paid','failed','refunded')),
  payment_provider text,
  payment_reference text,
  notes text check (char_length(coalesce(notes,'')) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at),
  check (end_time > start_time),
  check (deposit_paid_tzs <= price_tzs)
);

create index if not exists bookings_date_idx on public.bookings(appointment_date,start_time);
create index if not exists bookings_status_idx on public.bookings(status);
create index if not exists bookings_phone_idx on public.bookings(customer_phone);

-- Public users can only read active services. Writes to bookings are done through
-- the restricted RPC below; owner access is determined by salon_owners.
alter table public.salon_owners enable row level security;
alter table public.services enable row level security;
alter table public.bookings enable row level security;

drop policy if exists "Public can view active services" on public.services;
create policy "Public can view active services" on public.services
for select to anon, authenticated using (active = true);

drop policy if exists "Owners can manage services" on public.services;
create policy "Owners can manage services" on public.services
for all to authenticated
using (exists(select 1 from public.salon_owners o where o.user_id = auth.uid()))
with check (exists(select 1 from public.salon_owners o where o.user_id = auth.uid()));

drop policy if exists "Owners can read owner roster" on public.salon_owners;
create policy "Owners can read owner roster" on public.salon_owners
for select to authenticated using (user_id = auth.uid());

drop policy if exists "Owners can read bookings" on public.bookings;
create policy "Owners can read bookings" on public.bookings
for select to authenticated
using (exists(select 1 from public.salon_owners o where o.user_id = auth.uid()));

drop policy if exists "Owners can update bookings" on public.bookings;
create policy "Owners can update bookings" on public.bookings
for update to authenticated
using (exists(select 1 from public.salon_owners o where o.user_id = auth.uid()))
with check (exists(select 1 from public.salon_owners o where o.user_id = auth.uid()));

-- Exclusion constraint prevents overlapping active bookings for a single salon.
-- It assumes a single stylist/resource. If multiple stylists are added later,
-- add a staff_id and scope the exclusion constraint per staff member.
alter table public.bookings drop constraint if exists bookings_no_overlap;
alter table public.bookings add constraint bookings_no_overlap
exclude using gist (tstzrange(start_at,end_at,'[)') with &&)
where (status in ('pending','confirmed'));

-- Public booking RPC: security-definer function exposes only a safe booking reference
-- and serializes overlap checking/insertion. It snapshots the service price.
create or replace function public.create_public_booking(
  p_service_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_appointment_date date,
  p_start_time time,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_notes text default ''
)
returns table(booking_reference text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_service public.services%rowtype;
  v_ref text;
begin
  if char_length(trim(p_customer_name)) < 2 or char_length(p_customer_name) > 100 then
    raise exception 'invalid_customer';
  end if;
  if char_length(p_customer_phone) < 7 or char_length(p_customer_phone) > 25 then
    raise exception 'invalid_phone';
  end if;
  if char_length(coalesce(p_notes,'')) > 500 then raise exception 'invalid_notes'; end if;
  if p_appointment_date < (now() at time zone 'Africa/Dar_es_Salaam')::date then
    raise exception 'invalid_date';
  end if;
  if p_start_time < time '09:00' or p_start_time >= time '18:00' then
    raise exception 'outside_opening_hours';
  end if;
  select * into v_service from public.services where id=p_service_id and active=true;
  if not found then raise exception 'service_unavailable'; end if;
  if p_end_at <= p_start_at or p_end_at-p_start_at <> make_interval(mins=>v_service.duration_minutes) then
    raise exception 'invalid_duration';
  end if;
  if (p_end_at at time zone 'Africa/Dar_es_Salaam')::date <> p_appointment_date
    or (p_start_at at time zone 'Africa/Dar_es_Salaam')::date <> p_appointment_date then
    raise exception 'invalid_local_time';
  end if;
  if (p_end_at at time zone 'Africa/Dar_es_Salaam')::time > time '18:00' then
    raise exception 'outside_opening_hours';
  end if;
  if exists (
    select 1 from public.bookings b
    where b.status in ('pending','confirmed')
      and tstzrange(b.start_at,b.end_at,'[)') && tstzrange(p_start_at,p_end_at,'[)')
  ) then raise exception 'slot_unavailable'; end if;

  insert into public.bookings(
    service_id,customer_name,customer_phone,appointment_date,start_time,end_time,
    start_at,end_at,price_tzs,deposit_due_tzs,notes,status,payment_status
  ) values (
    v_service.id,trim(p_customer_name),trim(p_customer_phone),p_appointment_date,
    p_start_time,(p_end_at at time zone 'Africa/Dar_es_Salaam')::time,
    p_start_at,p_end_at,v_service.price_tzs,ceil(v_service.price_tzs/2.0)::integer,
    nullif(trim(coalesce(p_notes,'')),''),'pending','unpaid'
  ) returning bookings.booking_reference into v_ref;
  return query select v_ref;
end;
$$;

revoke all on function public.create_public_booking(uuid,text,text,date,time,timestamptz,timestamptz,text) from public;
grant execute on function public.create_public_booking(uuid,text,text,date,time,timestamptz,timestamptz,text) to anon, authenticated;

-- Seed services. Edit these illustrative prices before going live.
insert into public.services(name,description,price_tzs,duration_minutes,sort_order) values
 ('Knotless Braids','Neat, lightweight braids tailored to your style.',30000,240,10),
 ('Box Braids','Classic braids with your preferred length and finish.',25000,210,20),
 ('Butterfly Locs','A textured protective style with a soft finish.',40000,300,30),
 ('Cornrows','Clean lines and a style that fits your look.',15000,90,40),
 ('Lash Installation','Complete your look with a lash service.',15000,60,50),
 ('Wig Installation','A polished install for your next look.',20000,90,60)
on conflict(name) do nothing;

-- After creating the owner in Supabase Authentication, run this once,
-- replacing the UUID with that user's Auth UID:
-- insert into public.salon_owners(user_id,display_name)
-- values ('PASTE-OWNER-AUTH-USER-UUID-HERE','Shankuu');
