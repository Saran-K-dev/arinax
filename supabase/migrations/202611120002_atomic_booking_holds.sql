-- Booking holds are the only customer write path. Every reservation attempt is
-- serialized by facility and date, quoted from database pricing, and expires.
create extension if not exists pg_cron with schema pg_catalog;

create table public.booking_holds (
  id uuid primary key default gen_random_uuid(),
  request_token uuid not null,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  facility_id uuid not null references public.facilities(id) on delete cascade,
  booking_date date not null,
  start_time time not null,
  duration_hours smallint not null check (duration_hours between 1 and 24),
  hourly_rates numeric[] not null,
  total_amount numeric(10,2) not null check (total_amount >= 0),
  advance_amount numeric(10,2) not null check (advance_amount >= 0),
  balance_amount numeric(10,2) not null check (balance_amount >= 0),
  status text not null default 'active' check (status in ('active','converted','released','expired')),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  created_at timestamptz not null default now(),
  unique(customer_id, request_token)
);
create index booking_holds_active_slot_idx on public.booking_holds(facility_id, booking_date, start_time)
  where status = 'active';

create or replace function public.prevent_blocked_booking_overlap() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.facility_id::text || new.slot_date::text, 0));
  if exists (select 1 from public.bookings b where b.facility_id = new.facility_id and b.booking_date = new.slot_date
      and b.status <> 'cancelled' and new.slot_date + new.start_time < b.booking_date + b.start_time + make_interval(hours => b.duration_hours)
      and b.booking_date + b.start_time < new.slot_date + new.start_time + make_interval(hours => new.duration_hours))
    or exists (select 1 from public.booking_holds h where h.facility_id = new.facility_id and h.booking_date = new.slot_date
      and h.status = 'active' and h.expires_at > now()
      and new.slot_date + new.start_time < h.booking_date + h.start_time + make_interval(hours => h.duration_hours)
      and h.booking_date + h.start_time < new.slot_date + new.start_time + make_interval(hours => new.duration_hours))
  then raise exception 'Blocked slot overlaps an existing booking or active checkout hold'; end if;
  return new;
end $$;

alter table public.bookings add column if not exists hold_id uuid unique references public.booking_holds(id);
alter table public.bookings add column if not exists booking_reference text;
alter table public.bookings add column if not exists payment_status text not null default 'unpaid'
  check (payment_status in ('unpaid','pending','partial','paid','failed','refunded'));
update public.bookings set booking_reference = 'AX-' || upper(substr(replace(id::text, '-', ''), 1, 12))
  where booking_reference is null;
alter table public.bookings alter column booking_reference set default ('AX-' || upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 12)));
alter table public.bookings alter column booking_reference set not null;
create unique index if not exists bookings_booking_reference_key on public.bookings(booking_reference);

alter table public.booking_holds enable row level security;
create policy "customers read own holds" on public.booking_holds for select to authenticated
  using (customer_id = (select auth.uid()) or (select public.is_admin()));
grant select on public.booking_holds to authenticated;
revoke insert, update, delete on public.bookings from authenticated;
grant select, update on public.bookings to authenticated;

create or replace function public.create_booking_hold(
  p_facility_id uuid, p_booking_date date, p_start_time time,
  p_duration_hours integer, p_request_token uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_customer_id uuid := auth.uid();
  v_pricing public.facility_pricing%rowtype;
  v_existing public.booking_holds%rowtype;
  v_start timestamp;
  v_end timestamp;
  v_open smallint;
  v_close smallint := 23;
  v_rates numeric[];
  v_total numeric(10,2);
  v_advance numeric(10,2);
  v_hold public.booking_holds%rowtype;
begin
  if v_customer_id is null then raise exception 'Sign in before reserving a slot' using errcode = '28000'; end if;
  if p_facility_id is null or p_booking_date is null or p_start_time is null or p_duration_hours is null then
    raise exception 'Facility, date, time, and duration are required';
  end if;
  if p_request_token is null then raise exception 'A request token is required'; end if;
  if p_duration_hours < 1 or p_duration_hours > 12 then raise exception 'Duration must be between 1 and 12 hours'; end if;
  if p_start_time <> date_trunc('hour', p_start_time)::time then raise exception 'Start time must be on the hour'; end if;

  -- A stable token makes retries and React Strict Mode remounts idempotent.
  perform pg_advisory_xact_lock(hashtextextended(v_customer_id::text || p_request_token::text, 0));
  select * into v_existing from public.booking_holds
    where customer_id = v_customer_id and request_token = p_request_token for update;
  if found then
    if v_existing.status = 'active' and v_existing.expires_at > now()
      and v_existing.facility_id = p_facility_id and v_existing.booking_date = p_booking_date
      and v_existing.start_time = p_start_time and v_existing.duration_hours = p_duration_hours then
      return jsonb_build_object('id', v_existing.id, 'expires_at', v_existing.expires_at,
        'hourly_rates', v_existing.hourly_rates, 'total_amount', v_existing.total_amount,
        'advance_amount', v_existing.advance_amount, 'balance_amount', v_existing.balance_amount);
    end if;
    raise exception 'This checkout request token is already used. Start checkout again';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_facility_id::text || p_booking_date::text, 0));
  update public.booking_holds set status = 'expired'
    where facility_id = p_facility_id and booking_date = p_booking_date and status = 'active' and expires_at <= now();

  if not exists(select 1 from public.facilities where id = p_facility_id and is_active) then
    raise exception 'Facility is unavailable';
  end if;
  select * into v_pricing from public.facility_pricing where facility_id = p_facility_id for share;
  if not found then raise exception 'Facility pricing is not configured'; end if;

  v_open := case when extract(isodow from p_booking_date) in (6,7) then 5 else 6 end;
  v_start := p_booking_date + p_start_time;
  v_end := v_start + make_interval(hours => p_duration_hours);
  if v_start <= (now() at time zone 'Asia/Kolkata') then raise exception 'Bookings must start in the future'; end if;
  if extract(hour from p_start_time) < v_open or v_end > p_booking_date + make_time(v_close, 0, 0) then
    raise exception 'Selected time is outside facility operating hours';
  end if;

  select array_agg(round((case when extract(hour from (p_start_time + make_interval(hours => gs.hour_offset))) >= v_pricing.peak_start
                                  and extract(hour from (p_start_time + make_interval(hours => gs.hour_offset))) < v_pricing.peak_end
                                then v_pricing.peak_price else v_pricing.base_price end)
                              * case when extract(isodow from p_booking_date) in (6,7) then v_pricing.weekend_multiplier else 1 end)
                    order by gs.hour_offset)
    into v_rates from generate_series(0, p_duration_hours - 1) as gs(hour_offset);
  select coalesce(sum(rate), 0) into v_total from unnest(v_rates) as rates(rate);
  v_total := round(v_total, 2);
  v_advance := round(v_total * v_pricing.advance_percent / 100, 2);

  if exists(select 1 from public.bookings b where b.facility_id = p_facility_id and b.booking_date = p_booking_date
      and b.status <> 'cancelled' and v_start < b.booking_date + b.start_time + make_interval(hours => b.duration_hours)
      and b.booking_date + b.start_time < v_end) then raise exception 'This time overlaps an existing booking'; end if;
  if exists(select 1 from public.blocked_slots s where s.facility_id = p_facility_id and s.slot_date = p_booking_date
      and v_start < s.slot_date + s.start_time + make_interval(hours => s.duration_hours)
      and s.slot_date + s.start_time < v_end) then raise exception 'This time is blocked'; end if;
  if exists(select 1 from public.booking_holds h where h.facility_id = p_facility_id and h.booking_date = p_booking_date
      and h.status = 'active' and h.expires_at > now()
      and v_start < h.booking_date + h.start_time + make_interval(hours => h.duration_hours)
      and h.booking_date + h.start_time < v_end) then raise exception 'This slot is temporarily held by another customer'; end if;

  insert into public.booking_holds(request_token, customer_id, facility_id, booking_date, start_time,
      duration_hours, hourly_rates, total_amount, advance_amount, balance_amount)
    values(p_request_token, v_customer_id, p_facility_id, p_booking_date, p_start_time,
      p_duration_hours, v_rates, v_total, v_advance, v_total - v_advance)
    returning * into v_hold;
  return jsonb_build_object('id', v_hold.id, 'expires_at', v_hold.expires_at,
    'hourly_rates', v_hold.hourly_rates, 'total_amount', v_hold.total_amount,
    'advance_amount', v_hold.advance_amount, 'balance_amount', v_hold.balance_amount);
end;
$$;

create or replace function public.finalize_booking_hold(
  p_hold_id uuid, p_customer_name text, p_customer_phone text, p_payment_mode text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_customer_id uuid := auth.uid();
  h public.booking_holds%rowtype;
  b public.bookings%rowtype;
  v_deposit numeric(10,2);
begin
  if v_customer_id is null then raise exception 'Sign in before confirming a booking' using errcode = '28000'; end if;
  if p_payment_mode not in ('advance','full') then raise exception 'Choose advance or full payment'; end if;
  if length(trim(coalesce(p_customer_name,''))) < 2 or length(trim(coalesce(p_customer_phone,''))) < 8 then
    raise exception 'Enter a valid name and phone number';
  end if;
  select * into h from public.booking_holds where id = p_hold_id and customer_id = v_customer_id for update;
  if not found or h.status <> 'active' or h.expires_at <= now() then
    if found and h.status = 'active' then update public.booking_holds set status = 'expired' where id = h.id; end if;
    raise exception 'Your slot hold expired. Please select the slot again';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(h.facility_id::text || h.booking_date::text, 0));
  if h.booking_date + h.start_time <= (now() at time zone 'Asia/Kolkata') then
    update public.booking_holds set status = 'expired' where id = h.id;
    raise exception 'Bookings must start in the future';
  end if;
  if exists(select 1 from public.bookings x where x.facility_id = h.facility_id and x.booking_date = h.booking_date
      and x.status <> 'cancelled' and h.booking_date + h.start_time < x.booking_date + x.start_time + make_interval(hours => x.duration_hours)
      and x.booking_date + x.start_time < h.booking_date + h.start_time + make_interval(hours => h.duration_hours))
    or exists(select 1 from public.blocked_slots s where s.facility_id = h.facility_id and s.slot_date = h.booking_date
      and h.booking_date + h.start_time < s.slot_date + s.start_time + make_interval(hours => s.duration_hours)
      and s.slot_date + s.start_time < h.booking_date + h.start_time + make_interval(hours => h.duration_hours)) then
    update public.booking_holds set status = 'released' where id = h.id;
    raise exception 'This slot is no longer available';
  end if;

  v_deposit := case when p_payment_mode = 'full' then h.total_amount else h.advance_amount end;
  insert into public.bookings(hold_id, customer_id, facility_id, booking_date, start_time, duration_hours,
      total_amount, advance_amount, balance_amount, customer_name, customer_phone, payment_mode,
      payment_status, status)
    values(h.id, v_customer_id, h.facility_id, h.booking_date, h.start_time, h.duration_hours,
      h.total_amount, v_deposit, h.total_amount - v_deposit, trim(p_customer_name), trim(p_customer_phone),
      p_payment_mode, 'unpaid', 'pending') returning * into b;
  update public.booking_holds set status = 'converted' where id = h.id;
  return jsonb_build_object('id', b.id, 'booking_reference', b.booking_reference, 'created_at', b.created_at,
    'status', b.status, 'payment_status', b.payment_status, 'total_amount', b.total_amount,
    'advance_amount', b.advance_amount, 'balance_amount', b.balance_amount);
end;
$$;

create or replace function public.release_booking_hold(p_hold_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.booking_holds set status = 'released'
    where id = p_hold_id and customer_id = auth.uid() and status = 'active';
  return found;
end;
$$;

create or replace function public.expire_booking_holds() returns integer
language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  update public.booking_holds set status = 'expired' where status = 'active' and expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.get_unavailable_slots(p_facility_id uuid, p_date date)
returns table(start_time time) language sql stable security definer set search_path = '' as $$
  select distinct slots.slot_time from (
    select b.start_time + make_interval(hours => gs.hour_offset) as slot_time
      from public.bookings b cross join lateral generate_series(0, b.duration_hours - 1) as gs(hour_offset)
      where b.facility_id = p_facility_id and b.booking_date = p_date and b.status <> 'cancelled'
    union all
    select s.start_time + make_interval(hours => gs.hour_offset) as slot_time
      from public.blocked_slots s cross join lateral generate_series(0, s.duration_hours - 1) as gs(hour_offset)
      where s.facility_id = p_facility_id and s.slot_date = p_date
    union all
    select h.start_time + make_interval(hours => gs.hour_offset) as slot_time
      from public.booking_holds h cross join lateral generate_series(0, h.duration_hours - 1) as gs(hour_offset)
      where h.facility_id = p_facility_id and h.booking_date = p_date and h.status = 'active' and h.expires_at > now()
  ) slots
$$;

create or replace function public.reject_booking_overlap_with_hold() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_start timestamp := new.booking_date + new.start_time;
  v_end timestamp := new.booking_date + new.start_time + make_interval(hours => new.duration_hours);
begin
  if new.hold_id is null and exists(select 1 from public.booking_holds h where h.facility_id = new.facility_id
      and h.booking_date = new.booking_date and h.status = 'active' and h.expires_at > now()
      and v_start < h.booking_date + h.start_time + make_interval(hours => h.duration_hours)
      and h.booking_date + h.start_time < v_end) then
    raise exception 'This slot is temporarily held by a customer';
  end if;
  return new;
end;
$$;
create trigger reject_booking_overlap_with_hold_before_write before insert or update of facility_id, booking_date, start_time, duration_hours, hold_id
  on public.bookings for each row execute function public.reject_booking_overlap_with_hold();
-- This second check runs after the existing booking validator has acquired the
-- same facility/date advisory lock, closing the admin-insert vs hold race.
create trigger z_reject_booking_overlap_with_hold_after_lock before insert or update of facility_id, booking_date, start_time, duration_hours, hold_id
  on public.bookings for each row execute function public.reject_booking_overlap_with_hold();

revoke all on function public.create_booking_hold(uuid,date,time,integer,uuid) from public;
revoke all on function public.finalize_booking_hold(uuid,text,text,text) from public;
revoke all on function public.release_booking_hold(uuid) from public;
revoke all on function public.expire_booking_holds() from public, anon, authenticated;
revoke all on function public.get_unavailable_slots(uuid,date) from public;
grant execute on function public.create_booking_hold(uuid,date,time,integer,uuid) to authenticated;
grant execute on function public.finalize_booking_hold(uuid,text,text,text) to authenticated;
grant execute on function public.release_booking_hold(uuid) to authenticated;
grant execute on function public.expire_booking_holds() to service_role;
grant execute on function public.get_unavailable_slots(uuid,date) to anon, authenticated;

-- Expired holds stop blocking slots immediately. If pg_cron is enabled, clean
-- their rows on a schedule as well.
do $$ begin
  if exists(select 1 from pg_catalog.pg_extension where extname = 'pg_cron') then
    begin
      execute 'select cron.unschedule(jobid) from cron.job where jobname = ''arena-x-expire-booking-holds''';
      execute 'select cron.schedule(''arena-x-expire-booking-holds'', ''* * * * *'', ''select public.expire_booking_holds()'')';
    exception when others then
      raise notice 'pg_cron is enabled but could not schedule hold cleanup; expired holds are still ignored by availability';
    end;
  end if;
end $$;
