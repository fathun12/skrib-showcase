-- 0035_notifications_count_rate_limit.sql
-- Rate limit for GET /api/notifications/count (the bell polls it).
-- Each open tab asks about once a minute; 300 per 10 minutes allows about
-- 30 a minute per user, which is many tabs.

begin;

insert into private.rate_limit_rules (action, max_hits, window_seconds)
values ('notifications_count', 300, 600)
on conflict (action) do nothing;

commit;