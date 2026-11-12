-- Administrator-only data access and writes for the ARENA X management area.
-- These functions re-check the caller's database role; frontend route guards
-- are only for navigation and are never an authorization boundary.

grant insert, update, delete on public.sports, public.facilities,
  public.facility_pricing, public.blocked_slots to authenticated;

create or replace function public.admin_list_bookings()
returns table (
  id uuid, booking_reference text, facility_id uuid, facility_name text,
  booking_date date, start_time time, duration_hours smallint,
  total_amount numeric, advance_amount numeric, balance_amount numeric,
  payment_mode text, status text, payment_status text, created_at timestamptz,
  customer_name text, customer_phone text, customer_email text, amount_paid numeric
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select public.is_admin()) then raise exception 'Administrator access required' using errcode = '42501'; end if;
  return query
    select b.id, coalesce(b.booking_reference, b.id::text), b.facility_id, f.name,
      b.booking_date, b.start_time, b.duration_hours, b.total_amount, b.advance_amount,
      b.balance_amount, b.payment_mode, b.status, b.payment_status, b.created_at,
      b.customer_name, b.customer_phone, u.email::text,
      coalesce((select sum(p.amount) from public.payments p where p.booking_id = b.id and p.status = 'succeeded'), 0)::numeric
    from public.bookings b
    join public.facilities f on f.id = b.facility_id
    left join auth.users u on u.id = b.customer_id
    order by b.created_at desc;
end;
$$;

create or replace function public.admin_list_payments()
returns table (
  id uuid, booking_id uuid, booking_reference text, customer_name text,
  customer_phone text, customer_email text, facility_name text,
  amount numeric, currency text, provider text, provider_reference text,
  status text, created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select public.is_admin()) then raise exception 'Administrator access required' using errcode = '42501'; end if;
  return query
    select p.id, p.booking_id, coalesce(b.booking_reference, b.id::text),
      coalesce(b.customer_name, pr.full_name, ''), coalesce(b.customer_phone, pr.phone, ''),
      u.email::text, f.name, p.amount, p.currency, p.provider, p.provider_reference,
      p.status, p.created_at
    from public.payments p
    join public.bookings b on b.id = p.booking_id
    join public.facilities f on f.id = b.facility_id
    left join public.profiles pr on pr.id = p.customer_id
    left join auth.users u on u.id = p.customer_id
    order by p.created_at desc;
end;
$$;

create or replace function public.admin_save_facility(
  p_id uuid, p_name text, p_category text, p_description text, p_location text,
  p_images text[], p_amenities text[], p_sports text[], p_is_active boolean,
  p_base_price numeric, p_peak_price numeric, p_weekend_multiplier numeric,
  p_advance_percent numeric, p_peak_start smallint, p_peak_end smallint
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not (select public.is_admin()) then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Facility name must contain at least two characters'; end if;
  if p_category not in ('cricket','box-cricket','football','badminton','multi-sport') then raise exception 'Choose a valid facility category'; end if;
  if coalesce(p_base_price, -1) < 0 or coalesce(p_peak_price, -1) < 0 then raise exception 'Hourly prices cannot be negative'; end if;
  if coalesce(p_weekend_multiplier, 0) <= 0 or p_advance_percent not between 0 and 100 then raise exception 'Weekend multiplier or advance percentage is invalid'; end if;
  if p_peak_start not between 0 and 23 or p_peak_end not between 1 and 24 or p_peak_start >= p_peak_end then raise exception 'Peak hours are invalid'; end if;

  if p_id is null then
    insert into public.facilities(name, category, description, location, images, amenities, sports, is_active)
    values(trim(p_name), p_category, coalesce(p_description, ''), coalesce(p_location, ''),
      coalesce(p_images, '{}'), coalesce(p_amenities, '{}'), coalesce(p_sports, '{}'), coalesce(p_is_active, true))
    returning id into v_id;
  else
    update public.facilities set name = trim(p_name), category = p_category,
      description = coalesce(p_description, ''), location = coalesce(p_location, ''),
      images = coalesce(p_images, '{}'), amenities = coalesce(p_amenities, '{}'),
      sports = coalesce(p_sports, '{}'), is_active = coalesce(p_is_active, true)
    where id = p_id returning id into v_id;
    if v_id is null then raise exception 'Facility not found'; end if;
  end if;

  insert into public.facility_pricing(facility_id, base_price, peak_price, weekend_multiplier, advance_percent, peak_start, peak_end)
  values(v_id, p_base_price, p_peak_price, p_weekend_multiplier, p_advance_percent, p_peak_start, p_peak_end)
  on conflict(facility_id) do update set base_price = excluded.base_price,
    peak_price = excluded.peak_price, weekend_multiplier = excluded.weekend_multiplier,
    advance_percent = excluded.advance_percent, peak_start = excluded.peak_start, peak_end = excluded.peak_end;
  return v_id;
end;
$$;

create or replace function public.admin_record_payment(
  p_booking_id uuid, p_amount numeric, p_method text, p_reference text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare b public.bookings%rowtype; v_paid numeric; v_id uuid;
begin
  if not (select public.is_admin()) then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Payment amount must be greater than zero'; end if;
  if nullif(trim(coalesce(p_method, '')), '') is null then raise exception 'Select a payment method'; end if;
  select * into b from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found'; end if;
  if b.status = 'cancelled' then raise exception 'Cannot record payment for a cancelled booking'; end if;
  select coalesce(sum(amount), 0) into v_paid from public.payments where booking_id = b.id and status = 'succeeded';
  if v_paid + p_amount > b.total_amount then raise exception 'Payment exceeds the outstanding balance of %', round(b.total_amount - v_paid, 2); end if;
  insert into public.payments(booking_id, customer_id, amount, currency, provider, provider_reference, status)
    values(b.id, b.customer_id, round(p_amount, 2), 'INR', trim(p_method), nullif(trim(coalesce(p_reference, '')), ''), 'succeeded')
    returning id into v_id;
  update public.bookings set payment_status = case when v_paid + p_amount >= b.total_amount then 'paid' else 'partial' end
    where id = b.id;
  return v_id;
end;
$$;

revoke all on function public.admin_list_bookings() from public, anon;
revoke all on function public.admin_list_payments() from public, anon;
revoke all on function public.admin_save_facility(uuid,text,text,text,text,text[],text[],text[],boolean,numeric,numeric,numeric,numeric,smallint,smallint) from public, anon;
revoke all on function public.admin_record_payment(uuid,numeric,text,text) from public, anon;
grant execute on function public.admin_list_bookings() to authenticated;
grant execute on function public.admin_list_payments() to authenticated;
grant execute on function public.admin_save_facility(uuid,text,text,text,text,text[],text[],text[],boolean,numeric,numeric,numeric,numeric,smallint,smallint) to authenticated;
grant execute on function public.admin_record_payment(uuid,numeric,text,text) to authenticated;
