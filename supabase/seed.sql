insert into public.sports(slug,name,icon,description) values
('cricket','Cricket Turf','🏏','Professional cricket pitches with floodlights and practice nets'),
('box-cricket','Box Cricket','🏟️','Fast-paced box cricket arenas for quick matches'),
('football','Football Turf','⚽','Artificial football turf with LED lighting'),
('badminton','Badminton Court','🏸','Indoor courts with professional nets'),
('multi-sport','Multi-Sport','🏆','Versatile arenas for multiple sports') on conflict(slug) do nothing;

with f(id,name,category,description,location,images,amenities,sports,rating,review_count,base,peak) as (values
('10000000-0000-4000-8000-000000000001'::uuid,'Royal Cricket Ground','cricket','Our flagship cricket ground features a full-size pitch with professional-grade grass, floodlit for evening matches.','Block A, Green Valley Sports Complex',array['https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&q=80','https://images.unsplash.com/photo-1593766788306-28561086694e?w=800&q=80'],array['Floodlights','Practice Nets','Pavilion','Parking','Drinking Water','Changing Room'],array['Cricket'],4.8,124,2000,3000),
('10000000-0000-4000-8000-000000000002'::uuid,'Urban Box Cricket Arena','box-cricket','High-energy box cricket in an enclosed arena with artificial turf, side nets, and LED scoreboards.','Block B, Green Valley Sports Complex',array['https://images.unsplash.com/photo-1593766788306-28561086694e?w=800&q=80','https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&q=80'],array['LED Lighting','Side Nets','Scoreboard','Parking','Refreshments'],array['Box Cricket'],4.6,89,1200,1800),
('10000000-0000-4000-8000-000000000003'::uuid,'Elite Football Turf','football','Premium 5-a-side and 7-a-side football pitches with synthetic grass and LED floodlights.','Block C, Green Valley Sports Complex',array['https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800&q=80','https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=800&q=80'],array['FIFA Turf','Boundary Walls','Floodlights','Goalpost','Parking','Changing Room'],array['Football','Futsal'],4.9,203,1800,2700),
('10000000-0000-4000-8000-000000000004'::uuid,'City Badminton Courts','badminton','Air-conditioned indoor badminton courts with professional flooring and lighting.','Block D, Green Valley Sports Complex',array['https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&q=80'],array['Air Conditioned','BWF Flooring','Racket Rental','Shuttle','Locker Room'],array['Badminton'],4.7,156,600,900),
('10000000-0000-4000-8000-000000000005'::uuid,'Flexi Multi-Sport Arena','multi-sport','A convertible multi-purpose arena for basketball, volleyball, futsal, throwball and more.','Block E, Green Valley Sports Complex',array['https://images.unsplash.com/photo-1546519638405-a9d1b5f2a5b6?w=800&q=80','https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800&q=80'],array['Convertible Layout','Bleachers','Sound System','Parking','Cafeteria'],array['Basketball','Volleyball','Futsal','Throwball'],4.9,78,3000,4500)
)
insert into public.facilities(id,name,category,description,location,images,amenities,sports,rating,review_count)
select id,name,category,description,location,images,amenities,sports,rating,review_count from f
on conflict(id) do nothing;
with rates(id,base,peak) as (values
('10000000-0000-4000-8000-000000000001'::uuid,2000,3000),('10000000-0000-4000-8000-000000000002'::uuid,1200,1800),
('10000000-0000-4000-8000-000000000003'::uuid,1800,2700),('10000000-0000-4000-8000-000000000004'::uuid,600,900),
('10000000-0000-4000-8000-000000000005'::uuid,3000,4500))
insert into public.facility_pricing(facility_id,base_price,peak_price)
select id,base,peak from rates on conflict(facility_id) do nothing;
