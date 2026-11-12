-- Razorpay order, verification, and webhook state. No card data is stored.
create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  hold_id uuid not null references public.booking_holds(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  payment_mode text not null check (payment_mode in ('advance','full')),
  amount numeric(10,2) not null check (amount > 0),
  currency text not null default 'INR' check (currency = 'INR'),
  status text not null default 'creating' check (status in ('creating','pending','authorized','failed','cancelled','paid','expired','refund_required')),
  order_id text unique,
  payment_id text unique,
  payment_method text,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  booking_id uuid unique references public.bookings(id) on delete set null,
  last_failure text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(hold_id, payment_mode)
);
create index if not exists payment_attempts_customer_idx on public.payment_attempts(customer_id, created_at desc);
drop trigger if exists payment_attempts_updated_at on public.payment_attempts;
create trigger payment_attempts_updated_at before update on public.payment_attempts
for each row execute function public.set_updated_at();

create table if not exists public.razorpay_webhook_events (
  event_id text primary key,
  event_type text not null,
  payment_attempt_id uuid references public.payment_attempts(id) on delete set null,
  processed_at timestamptz not null default now()
);

alter table public.payment_attempts enable row level security;
alter table public.razorpay_webhook_events enable row level security;
revoke all on public.payment_attempts, public.razorpay_webhook_events from public, anon, authenticated;
grant select, insert, update on public.payment_attempts, public.razorpay_webhook_events to service_role;
create unique index if not exists payments_razorpay_payment_id_unique
  on public.payments(provider_reference) where provider = 'razorpay' and provider_reference is not null;

-- The advance payment plan is exactly 50%, separate from any legacy venue advance setting.
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
  if new.advance_amount not in (expected_advance, expected_total, round(expected_total * 0.5, 2))
      or new.balance_amount <> expected_total - new.advance_amount then
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

create or replace function public.claim_razorpay_attempt(
  p_hold_id uuid, p_customer_id uuid, p_payment_mode text,
  p_customer_name text, p_customer_phone text, p_customer_email text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare h public.booking_holds%rowtype; a public.payment_attempts%rowtype; v_amount numeric(10,2);
begin
  perform pg_advisory_xact_lock(hashtextextended(p_hold_id::text, 0));
  select * into h from public.booking_holds where id = p_hold_id and customer_id = p_customer_id for update;
  if not found or h.status <> 'active' or h.expires_at <= now() then raise exception 'Your slot hold expired. Select the slot again.'; end if;
  if p_payment_mode not in ('advance','full') then raise exception 'Choose full payment or 50%% advance'; end if;
  if length(trim(coalesce(p_customer_name,''))) < 2 or length(trim(coalesce(p_customer_phone,''))) < 8 then raise exception 'Enter a valid name and phone number'; end if;
  v_amount := case when p_payment_mode = 'full' then h.total_amount else round(h.total_amount * 0.5, 2) end;
  if v_amount <= 0 then raise exception 'Booking amount must be greater than zero'; end if;
  select * into a from public.payment_attempts where hold_id = h.id and payment_mode = p_payment_mode for update;
  if found then
    if a.order_id is not null then
      if a.status in ('failed','cancelled') then update public.payment_attempts set status = 'pending', last_failure = null where id = a.id; end if;
      return jsonb_build_object('attempt_id', a.id, 'order_id', a.order_id, 'amount', a.amount, 'status', 'pending', 'is_new', false);
    end if;
    if a.status = 'creating' and a.created_at > now() - interval '2 minutes' then
      return jsonb_build_object('attempt_id', a.id, 'amount', a.amount, 'status', 'creating', 'is_new', false);
    end if;
    update public.payment_attempts set status = 'creating', amount = v_amount,
      customer_name = trim(p_customer_name), customer_phone = trim(p_customer_phone), customer_email = p_customer_email,
      last_failure = null, created_at = now()
      where id = a.id returning * into a;
  else
    insert into public.payment_attempts(hold_id, customer_id, payment_mode, amount, customer_name, customer_phone, customer_email)
      values(h.id, p_customer_id, p_payment_mode, v_amount, trim(p_customer_name), trim(p_customer_phone), p_customer_email)
      returning * into a;
  end if;
  return jsonb_build_object('attempt_id', a.id, 'amount', a.amount, 'status', a.status, 'is_new', true);
end;
$$;

create or replace function public.attach_razorpay_order(p_attempt_id uuid, p_order_id text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_updated integer;
begin
  update public.payment_attempts set order_id = p_order_id, status = 'pending'
    where id = p_attempt_id and status = 'creating' and order_id is null;
  get diagnostics v_updated = row_count;
  if v_updated = 1 then return true; end if;
  return exists(select 1 from public.payment_attempts where id = p_attempt_id and order_id = p_order_id);
end;
$$;

create or replace function public.mark_razorpay_attempt(p_attempt_id uuid, p_status text, p_failure text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('authorized','failed','cancelled','expired') then raise exception 'Invalid payment attempt status'; end if;
  update public.payment_attempts set status = p_status, last_failure = left(coalesce(p_failure,''), 500)
    where id = p_attempt_id and status <> 'paid' and status <> 'refund_required';
  return found;
end;
$$;

create or replace function public.process_razorpay_payment_event(
  p_event_id text, p_event_type text, p_attempt_id uuid, p_order_id text,
  p_payment_id text, p_amount_paise bigint, p_currency text, p_payment_method text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.payment_attempts%rowtype; h public.booking_holds%rowtype; b public.bookings%rowtype;
  v_event_inserted integer; v_expected bigint;
begin
  if p_event_id is null or length(p_event_id) < 4 then raise exception 'Missing verified Razorpay event identifier'; end if;
  select * into a from public.payment_attempts where id = p_attempt_id;
  if not found then raise exception 'Payment attempt not found'; end if;
  select * into h from public.booking_holds where id = a.hold_id for update;
  if not found then raise exception 'Booking hold not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended(h.facility_id::text || h.booking_date::text, 0));
  select * into a from public.payment_attempts where id = p_attempt_id for update;
  insert into public.razorpay_webhook_events(event_id, event_type, payment_attempt_id)
    values(p_event_id, p_event_type, a.id) on conflict(event_id) do nothing;
  get diagnostics v_event_inserted = row_count;
  if v_event_inserted = 0 then
    if a.booking_id is not null then return jsonb_build_object('status','paid','booking_id',a.booking_id,'duplicate',true); end if;
    return jsonb_build_object('status',a.status,'duplicate',true);
  end if;

  if a.order_id is null or a.order_id <> p_order_id then raise exception 'Razorpay order does not match the payment attempt'; end if;
  if p_event_type = 'payment.failed' then
    if a.status <> 'paid' then update public.payment_attempts set status = 'failed', last_failure = 'Razorpay reported payment failure' where id = a.id; end if;
    return jsonb_build_object('status','failed');
  elsif p_event_type = 'payment.authorized' then
    if a.status <> 'paid' then update public.payment_attempts set status = 'authorized' where id = a.id; end if;
    return jsonb_build_object('status','authorized');
  elsif p_event_type not in ('payment.captured','order.paid') then
    return jsonb_build_object('status','ignored');
  end if;

  v_expected := round(a.amount * 100)::bigint;
  if p_payment_id is null or p_amount_paise <> v_expected or p_currency <> 'INR' then raise exception 'Razorpay payment amount or currency does not match'; end if;
  if a.booking_id is not null or a.status = 'paid' then return jsonb_build_object('status','paid','booking_id',a.booking_id,'duplicate',true); end if;
  if h.status <> 'active' or h.expires_at <= now() then
    update public.payment_attempts set status = 'refund_required', payment_id = p_payment_id,
      payment_method = p_payment_method, last_failure = 'Payment captured after the booking hold expired; refund required.' where id = a.id;
    return jsonb_build_object('status','refund_required','payment_id',p_payment_id);
  end if;
  if exists(select 1 from public.bookings x where x.facility_id = h.facility_id and x.booking_date = h.booking_date
      and x.status <> 'cancelled' and h.booking_date + h.start_time < x.booking_date + x.start_time + make_interval(hours => x.duration_hours)
      and x.booking_date + x.start_time < h.booking_date + h.start_time + make_interval(hours => h.duration_hours))
    or exists(select 1 from public.blocked_slots s where s.facility_id = h.facility_id and s.slot_date = h.booking_date
      and h.booking_date + h.start_time < s.slot_date + s.start_time + make_interval(hours => s.duration_hours)
      and s.slot_date + s.start_time < h.booking_date + h.start_time + make_interval(hours => h.duration_hours)) then
    update public.payment_attempts set status = 'refund_required', payment_id = p_payment_id,
      payment_method = p_payment_method, last_failure = 'Payment captured after the slot became unavailable; refund required.' where id = a.id;
    return jsonb_build_object('status','refund_required','payment_id',p_payment_id);
  end if;

  insert into public.bookings(hold_id, customer_id, facility_id, booking_date, start_time, duration_hours,
      total_amount, advance_amount, balance_amount, customer_name, customer_phone, payment_mode, payment_status, status)
    values(h.id, h.customer_id, h.facility_id, h.booking_date, h.start_time, h.duration_hours,
      h.total_amount, a.amount, h.total_amount - a.amount, a.customer_name, a.customer_phone,
      a.payment_mode, case when a.amount >= h.total_amount then 'paid' else 'partial' end, 'pending') returning * into b;
  insert into public.payments(booking_id, customer_id, amount, currency, provider, provider_reference, status)
    values(b.id, b.customer_id, a.amount, 'INR', 'razorpay', p_payment_id, 'succeeded');
  update public.booking_holds set status = 'converted' where id = h.id;
  update public.payment_attempts set status = 'paid', payment_id = p_payment_id,
    payment_method = p_payment_method, booking_id = b.id, last_failure = null where id = a.id;
  update public.payment_attempts set status = 'cancelled', last_failure = 'Another payment option for this hold completed.'
    where hold_id = h.id and id <> a.id and status in ('creating','pending','authorized');
  return jsonb_build_object('status','paid','booking_id',b.id,'booking_reference',b.booking_reference,
      'created_at',b.created_at,'booking_status',b.status,'payment_status',b.payment_status,
      'total_amount',b.total_amount,'advance_amount',b.advance_amount,'balance_amount',b.balance_amount,
      'payment_amount',a.amount,'payment_mode',a.payment_mode);
end;
$$;

create or replace function public.expire_razorpay_attempts() returns integer
language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  update public.payment_attempts a set status = 'expired'
    from public.booking_holds h where a.hold_id = h.id and h.status in ('expired','released')
    and a.status in ('creating','pending','authorized');
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.claim_razorpay_attempt(uuid,uuid,text,text,text,text) from public, anon, authenticated;
revoke all on function public.attach_razorpay_order(uuid,text) from public, anon, authenticated;
revoke all on function public.mark_razorpay_attempt(uuid,text,text) from public, anon, authenticated;
revoke all on function public.process_razorpay_payment_event(text,text,uuid,text,text,bigint,text,text) from public, anon, authenticated;
revoke all on function public.expire_razorpay_attempts() from public, anon, authenticated;
revoke all on function public.finalize_booking_hold(uuid,text,text,text) from public, anon, authenticated;
-- Reassert customer permissions for checkout holds when this migration is rerun
-- after a partial/failed SQL Editor execution.
revoke all on function public.create_booking_hold(uuid,date,time,integer,uuid) from public, anon;
revoke all on function public.release_booking_hold(uuid) from public, anon;
revoke all on function public.get_unavailable_slots(uuid,date) from public;
grant execute on function public.create_booking_hold(uuid,date,time,integer,uuid) to authenticated;
grant execute on function public.release_booking_hold(uuid) to authenticated;
grant execute on function public.get_unavailable_slots(uuid,date) to anon, authenticated;
grant execute on function public.claim_razorpay_attempt(uuid,uuid,text,text,text,text) to service_role;
grant execute on function public.attach_razorpay_order(uuid,text) to service_role;
grant execute on function public.mark_razorpay_attempt(uuid,text,text) to service_role;
grant execute on function public.process_razorpay_payment_event(text,text,uuid,text,text,bigint,text,text) to service_role;
grant execute on function public.expire_razorpay_attempts() to service_role;

do $$ begin
  if exists(select 1 from pg_catalog.pg_extension where extname = 'pg_cron') then
    begin
      execute 'select cron.unschedule(jobid) from cron.job where jobname = ''arena-x-expire-razorpay-attempts''';
      execute 'select cron.schedule(''arena-x-expire-razorpay-attempts'', ''* * * * *'', ''select public.expire_razorpay_attempts()'')';
    exception when others then
      raise notice 'Could not schedule Razorpay attempt cleanup; hold expiry still releases the slot and payment creation checks hold expiry';
    end;
  end if;
end $$;
