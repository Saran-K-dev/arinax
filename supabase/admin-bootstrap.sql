-- Run in Supabase SQL Editor after the admin user has been created in
-- Authentication > Users. Role changes must only be performed by a project owner.
do $$
declare
  promoted_id uuid;
begin
  insert into public.profiles(id, full_name, phone)
  select u.id,
         coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''), ''),
         nullif(u.raw_user_meta_data ->> 'phone', '')
    from auth.users u
   where lower(u.email) = lower('vorexs12@gmail.com')
  on conflict (id) do nothing;

  update public.profiles p
     set role = 'admin', updated_at = now()
    from auth.users u
   where u.id = p.id
     and lower(u.email) = lower('vorexs12@gmail.com')
  returning p.id into promoted_id;

  if promoted_id is null then
    raise exception 'No profile for vorexs12@gmail.com. Create/confirm the user in Supabase Auth first, then rerun this script.';
  end if;
end $$;
