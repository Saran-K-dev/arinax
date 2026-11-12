create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '', phone text,
  role text not null default 'customer' check (role in ('customer','admin')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.sports (
  id uuid primary key default gen_random_uuid(), slug text unique not null,
  name text not null, icon text not null default '', description text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.facilities (
  id uuid primary key default gen_random_uuid(), name text not null,
  category text not null check (category in ('cricket','box-cricket','football','badminton','multi-sport')),
  description text not null default '', location text not null default '',
  images text[] not null default '{}', amenities text[] not null default '{}',
  sports text[] not null default '{}', rating numeric(2,1) not null default 0 check (rating between 0 and 5),
  review_count integer not null default 0 check (review_count >= 0), is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.facility_pricing (
  id uuid primary key default gen_random_uuid(), facility_id uuid not null references public.facilities(id) on delete cascade,
  base_price numeric(10,2) not null check (base_price >= 0), peak_price numeric(10,2) not null check (peak_price >= 0),
  weekend_multiplier numeric(5,2) not null default 1 check (weekend_multiplier > 0),
  advance_percent numeric(5,2) not null default 30 check (advance_percent between 0 and 100),
  peak_start smallint not null default 18 check (peak_start between 0 and 23), peak_end smallint not null default 22 check (peak_end between 1 and 24),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(facility_id)
);
create table public.bookings (
  id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.profiles(id),
  facility_id uuid not null references public.facilities(id), booking_date date not null,
  start_time time not null, duration_hours smallint not null check (duration_hours between 1 and 24),
  total_amount numeric(10,2) not null check (total_amount >= 0), advance_amount numeric(10,2) not null default 0 check (advance_amount >= 0),
  balance_amount numeric(10,2) not null default 0 check (balance_amount >= 0),
  customer_name text not null, customer_phone text not null,
  payment_mode text not null default 'advance' check (payment_mode in ('advance','full')),
  status text not null default 'pending' check (status in ('pending','confirmed','cancelled','completed')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.payments (
  id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.bookings(id) on delete cascade,
  customer_id uuid not null references public.profiles(id), amount numeric(10,2) not null check (amount >= 0),
  currency text not null default 'INR', provider text, provider_reference text,
  status text not null default 'pending' check (status in ('pending','succeeded','failed','refunded')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.blocked_slots (
  id uuid primary key default gen_random_uuid(), facility_id uuid not null references public.facilities(id) on delete cascade,
  slot_date date not null, start_time time not null, duration_hours smallint not null default 1 check (duration_hours > 0),
  reason text not null default 'Maintenance', created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(facility_id, slot_date, start_time)
);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
do $$ declare t text; begin
  foreach t in array array['profiles','sports','facilities','facility_pricing','bookings','payments','blocked_slots'] loop
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, full_name, phone) values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), new.raw_user_meta_data->>'phone');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
-- Admin status is derived from the protected profile table. Clients cannot assign roles.
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = (select auth.uid()) and role = 'admin')
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.sports enable row level security;
alter table public.facilities enable row level security;
alter table public.facility_pricing enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.blocked_slots enable row level security;

create policy "profiles readable by self or admin" on public.profiles for select to authenticated using (id = (select auth.uid()) or (select public.is_admin()));
create policy "customers update own profile" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()) and role = 'customer');
create policy "admins manage profiles" on public.profiles for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "sports public read" on public.sports for select to anon, authenticated using (true);
create policy "admins manage sports" on public.sports for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "active facilities public read" on public.facilities for select to anon, authenticated using (is_active or (select public.is_admin()));
create policy "admins manage facilities" on public.facilities for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "pricing public read" on public.facility_pricing for select to anon, authenticated using (true);
create policy "admins manage pricing" on public.facility_pricing for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "customers read own bookings" on public.bookings for select to authenticated using (customer_id = (select auth.uid()) or (select public.is_admin()));
create policy "customers create own pending bookings" on public.bookings for insert to authenticated with check (customer_id = (select auth.uid()) and status = 'pending');
create policy "admins manage bookings" on public.bookings for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "payments visible to owner or admin" on public.payments for select to authenticated using (customer_id = (select auth.uid()) or (select public.is_admin()));
create policy "admins manage payments" on public.payments for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "blocked slots readable" on public.blocked_slots for select to anon, authenticated using (true);
create policy "admins manage blocked slots" on public.blocked_slots for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

grant select on public.sports, public.facilities, public.facility_pricing, public.blocked_slots to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update on public.bookings to authenticated;
grant select on public.payments to authenticated;

-- Validate quoted prices and prevent overlapping reservations atomically.
create or replace function public.validate_booking() returns trigger language plpgsql security definer set search_path = '' as $$
declare p public.facility_pricing%rowtype; expected_total numeric(10,2); expected_advance numeric(10,2);
  begin_at timestamp; end_at timestamp;
begin
  select * into p from public.facility_pricing where facility_id = new.facility_id;
  if not found then raise exception 'Facility pricing is not configured'; end if;
  begin_at := new.booking_date + new.start_time;
  end_at := begin_at + make_interval(hours => new.duration_hours);
  select sum(case when extract(hour from (new.start_time + make_interval(hours => offset_hour))) >= p.peak_start
                    and extract(hour from (new.start_time + make_interval(hours => offset_hour))) < p.peak_end
                  then p.peak_price else p.base_price end
                  * case when extract(isodow from new.booking_date) in (6,7) then p.weekend_multiplier else 1 end)
    into expected_total from generate_series(0, new.duration_hours - 1) as gs(offset_hour);
  expected_total := round(expected_total, 2);
  expected_advance := round(expected_total * p.advance_percent / 100, 2);
  if new.total_amount <> expected_total then raise exception 'Booking price does not match current facility pricing'; end if;
  if new.advance_amount not in (expected_advance, expected_total) or new.balance_amount <> expected_total - new.advance_amount then
    raise exception 'Booking payment amounts are invalid';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.facility_id::text || new.booking_date::text, 0));
  if exists (select 1 from public.bookings b where b.facility_id = new.facility_id and b.booking_date = new.booking_date
      and b.status <> 'cancelled' and b.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and begin_at < b.booking_date + b.start_time + make_interval(hours => b.duration_hours)
      and b.booking_date + b.start_time < end_at) then raise exception 'This time overlaps an existing booking'; end if;
  if exists (select 1 from public.blocked_slots s where s.facility_id = new.facility_id and s.slot_date = new.booking_date
      and begin_at < s.slot_date + s.start_time + make_interval(hours => s.duration_hours)
      and s.slot_date + s.start_time < end_at) then raise exception 'This time is blocked'; end if;
  return new;
end $$;
create trigger validate_booking_before_write before insert or update of facility_id, booking_date, start_time, duration_hours, total_amount, advance_amount, balance_amount on public.bookings
for each row execute function public.validate_booking();

create or replace function public.prevent_blocked_booking_overlap() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.facility_id::text || new.slot_date::text, 0));
  if exists (select 1 from public.bookings b where b.facility_id = new.facility_id and b.booking_date = new.slot_date
      and b.status <> 'cancelled' and new.slot_date + new.start_time < b.booking_date + b.start_time + make_interval(hours => b.duration_hours)
      and b.booking_date + b.start_time < new.slot_date + new.start_time + make_interval(hours => new.duration_hours))
  then raise exception 'Blocked slot overlaps an existing booking'; end if;
  return new;
end $$;
create trigger prevent_blocked_booking_overlap before insert or update on public.blocked_slots
for each row execute function public.prevent_blocked_booking_overlap();

create or replace function public.get_unavailable_slots(p_facility_id uuid, p_date date)
returns table(start_time time) language sql stable security definer set search_path = '' as $$
  select distinct slots.slot_time from (
    select b.start_time + make_interval(hours => gs.offset_hour) as slot_time
      from public.bookings b cross join lateral generate_series(0, b.duration_hours - 1) as gs(offset_hour)
      where b.facility_id = p_facility_id and b.booking_date = p_date and b.status <> 'cancelled'
    union all
    select s.start_time + make_interval(hours => gs.offset_hour) as slot_time
      from public.blocked_slots s cross join lateral generate_series(0, s.duration_hours - 1) as gs(offset_hour)
      where s.facility_id = p_facility_id and s.slot_date = p_date
  ) slots
$$;
revoke all on function public.get_unavailable_slots(uuid,date) from public;
grant execute on function public.get_unavailable_slots(uuid,date) to anon, authenticated;
