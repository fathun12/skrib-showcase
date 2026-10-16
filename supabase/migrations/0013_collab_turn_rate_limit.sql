-- 0013_collab_turn_rate_limit.sql
-- Run after 0012.
-- Co-authoring, step C8: rate limit for asking for a turn and for answering
-- one (hand over / not now). The lock functions themselves are in 0010.

begin;

insert into private.rate_limit_rules (action, max_hits, window_seconds) values
  ('collab_turn', 20, 600)   -- requestTurn, respondTurn
on conflict (action) do nothing;

commit;