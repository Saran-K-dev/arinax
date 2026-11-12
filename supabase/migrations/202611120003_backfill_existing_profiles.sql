-- Accounts created before the profile trigger/schema existed need a profile
-- row before they can create a booking (bookings reference profiles.id).
insert into public.profiles(id, full_name, phone)
select
  u.id,
  coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''), ''),
  nullif(u.raw_user_meta_data ->> 'phone', '')
from auth.users u
on conflict (id) do nothing;
