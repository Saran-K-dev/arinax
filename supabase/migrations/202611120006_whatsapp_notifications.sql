-- Official WhatsApp Cloud API outbox, consent, idempotency, and delivery status.
alter table public.payment_attempts
  add column if not exists whatsapp_opt_in boolean not null default false,
  add column if not exists whatsapp_opt_in_at timestamptz;
alter table public.bookings
  add column if not exists whatsapp_opt_in boolean not null default false,
  add column if not exists whatsapp_opt_in_at timestamptz;

create or replace function public.copy_payment_attempt_whatsapp_consent()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_opt_in boolean; v_opt_in_at timestamptz;
begin
  select a.whatsapp_opt_in, a.whatsapp_opt_in_at
    into v_opt_in, v_opt_in_at
  from public.payment_attempts a
  where a.hold_id = new.hold_id and a.customer_id = new.customer_id
  order by a.updated_at desc limit 1;
  if found then
    new.whatsapp_opt_in := v_opt_in;
    new.whatsapp_opt_in_at := v_opt_in_at;
  end if;
  return new;
end;
$$;
drop trigger if exists copy_payment_attempt_whatsapp_consent on public.bookings;
create trigger copy_payment_attempt_whatsapp_consent before insert on public.bookings
for each row execute function public.copy_payment_attempt_whatsapp_consent();

create table if not exists public.whatsapp_notifications (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  notification_type text not null check (notification_type in ('booking_confirmation','booking_cancelled','booking_reminder')),
  idempotency_key text not null unique,
  recipient text not null,
  template_variables jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','sending','sent','delivered','read','failed','unknown','simulated')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  claimed_at timestamptz,
  provider_message_id text unique,
  provider_status_at timestamptz,
  error_code text,
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists whatsapp_notifications_pending_idx
  on public.whatsapp_notifications(status, next_attempt_at, created_at);
drop trigger if exists whatsapp_notifications_updated_at on public.whatsapp_notifications;
create trigger whatsapp_notifications_updated_at before update on public.whatsapp_notifications
for each row execute function public.set_updated_at();

alter table public.whatsapp_notifications enable row level security;
revoke all on public.whatsapp_notifications from public, anon, authenticated;
grant select, insert, update on public.whatsapp_notifications to service_role;

create or replace function public.enqueue_whatsapp_notification(p_booking_id uuid, p_type text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if p_type not in ('booking_confirmation','booking_cancelled','booking_reminder') then
    raise exception 'Invalid WhatsApp notification type';
  end if;
  insert into public.whatsapp_notifications(booking_id, notification_type, idempotency_key, recipient, template_variables)
  select b.id, p_type, b.id::text || ':' || p_type, b.customer_phone,
    jsonb_build_object(
      'booking_reference', b.booking_reference,
      'facility_name', f.name,
      'booking_date', to_char(b.booking_date, 'YYYY-MM-DD'),
      'start_time', to_char(b.start_time, 'HH24:MI'),
      'duration_hours', b.duration_hours,
      'total_amount', b.total_amount,
      'paid_amount', coalesce(sum(p.amount) filter (where p.status = 'succeeded'), 0),
      'balance_amount', greatest(0, b.total_amount - coalesce(sum(p.amount) filter (where p.status = 'succeeded'), 0))
    )
  from public.bookings b
  join public.facilities f on f.id = b.facility_id
  left join public.payments p on p.booking_id = b.id
  where b.id = p_booking_id and b.whatsapp_opt_in
  group by b.id, f.name
  on conflict (idempotency_key) do nothing
  returning id into v_id;
  if v_id is null then
    select n.id into v_id from public.whatsapp_notifications n
      where n.idempotency_key = p_booking_id::text || ':' || p_type;
  end if;
  return v_id;
end;
$$;

create or replace function public.queue_verified_razorpay_whatsapp()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.provider = 'razorpay' and new.status = 'succeeded' then
    perform public.enqueue_whatsapp_notification(new.booking_id, 'booking_confirmation');
  end if;
  return new;
end;
$$;
drop trigger if exists queue_verified_razorpay_whatsapp on public.payments;
create trigger queue_verified_razorpay_whatsapp after insert or update of status on public.payments
for each row when (new.provider = 'razorpay' and new.status = 'succeeded')
execute function public.queue_verified_razorpay_whatsapp();

create or replace function public.queue_booking_cancellation_whatsapp()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'cancelled' and old.status is distinct from new.status then
    perform public.enqueue_whatsapp_notification(new.id, 'booking_cancelled');
  end if;
  return new;
end;
$$;
drop trigger if exists queue_booking_cancellation_whatsapp on public.bookings;
create trigger queue_booking_cancellation_whatsapp after update of status on public.bookings
for each row execute function public.queue_booking_cancellation_whatsapp();

create or replace function public.enqueue_whatsapp_booking_reminders()
returns integer language plpgsql security definer set search_path = '' as $$
declare r record; v_count integer := 0;
begin
  for r in
    select b.id from public.bookings b
    where b.status = 'confirmed' and b.whatsapp_opt_in
      and ((b.booking_date + b.start_time) at time zone 'Asia/Kolkata') between now() + interval '23 hours' and now() + interval '25 hours'
  loop
    perform public.enqueue_whatsapp_notification(r.id, 'booking_reminder');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Claiming is transactional. A crashed in-flight send becomes unknown rather
-- than being automatically resent, avoiding duplicate outbound messages.
create or replace function public.claim_whatsapp_notification()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare n public.whatsapp_notifications%rowtype;
begin
  update public.whatsapp_notifications set status = 'unknown',
    error_message = 'Worker stopped during send; delivery outcome needs review.'
  where status = 'sending' and claimed_at < now() - interval '10 minutes';

  select * into n from public.whatsapp_notifications
  where status = 'pending' and next_attempt_at <= now() and attempt_count < 5
  order by created_at for update skip locked limit 1;
  if not found then return null; end if;

  update public.whatsapp_notifications set status = 'sending', attempt_count = attempt_count + 1,
    claimed_at = now(), error_code = null, error_message = null
  where id = n.id returning * into n;
  return jsonb_build_object('id', n.id, 'notification_type', n.notification_type,
    'recipient', n.recipient, 'template_variables', n.template_variables, 'attempt_count', n.attempt_count);
end;
$$;

create or replace function public.finish_whatsapp_notification(
  p_id uuid, p_status text, p_message_id text default null,
  p_error_code text default null, p_error_message text default null, p_retry_after_seconds integer default null
) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('sent','failed','unknown','simulated') then raise exception 'Invalid WhatsApp delivery status'; end if;
  update public.whatsapp_notifications set
    status = case when p_status = 'failed' and p_retry_after_seconds between 1 and 86400 and attempt_count < 5 then 'pending' else p_status end,
    provider_message_id = coalesce(p_message_id, provider_message_id),
    sent_at = case when p_status in ('sent','simulated') then now() else sent_at end,
    next_attempt_at = case when p_status = 'failed' and p_retry_after_seconds between 1 and 86400 and attempt_count < 5
      then now() + make_interval(secs => p_retry_after_seconds) else next_attempt_at end,
    error_code = left(p_error_code, 100), error_message = left(p_error_message, 1000)
  where id = p_id and status = 'sending';
  return found;
end;
$$;

create or replace function public.apply_whatsapp_delivery_status(
  p_message_id text, p_status text, p_error_code text default null, p_error_message text default null
) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('sent','delivered','read','failed') then return false; end if;
  update public.whatsapp_notifications set
    status = case
      when status in ('read','delivered') and p_status in ('sent','failed') then status
      else p_status end,
    provider_status_at = now(),
    delivered_at = case when p_status in ('delivered','read') then coalesce(delivered_at, now()) else delivered_at end,
    read_at = case when p_status = 'read' then coalesce(read_at, now()) else read_at end,
    error_code = coalesce(left(p_error_code, 100), error_code),
    error_message = coalesce(left(p_error_message, 1000), error_message)
  where provider_message_id = p_message_id;
  return found;
end;
$$;

revoke all on function public.enqueue_whatsapp_notification(uuid,text) from public, anon, authenticated;
revoke all on function public.enqueue_whatsapp_booking_reminders() from public, anon, authenticated;
revoke all on function public.claim_whatsapp_notification() from public, anon, authenticated;
revoke all on function public.finish_whatsapp_notification(uuid,text,text,text,text,integer) from public, anon, authenticated;
revoke all on function public.apply_whatsapp_delivery_status(text,text,text,text) from public, anon, authenticated;
grant execute on function public.enqueue_whatsapp_notification(uuid,text) to service_role;
grant execute on function public.enqueue_whatsapp_booking_reminders() to service_role;
grant execute on function public.claim_whatsapp_notification() to service_role;
grant execute on function public.finish_whatsapp_notification(uuid,text,text,text,text,integer) to service_role;
grant execute on function public.apply_whatsapp_delivery_status(text,text,text,text) to service_role;

do $$ begin
  if exists(select 1 from pg_catalog.pg_extension where extname = 'pg_cron') then
    begin
      execute 'select cron.unschedule(jobid) from cron.job where jobname = ''arena-x-whatsapp-reminders''';
      execute 'select cron.schedule(''arena-x-whatsapp-reminders'', ''*/10 * * * *'', ''select public.enqueue_whatsapp_booking_reminders()'')';
    exception when others then
      raise notice 'Could not schedule WhatsApp reminders; server worker can call enqueue_whatsapp_booking_reminders manually';
    end;
  end if;
end $$;
