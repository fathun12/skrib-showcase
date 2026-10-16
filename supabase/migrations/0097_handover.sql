-- 0097_handover.sql
-- Editor handover: "Send to author" / "Send to editor" with an optional note.
-- Saves a labelled version, gives the pen back and writes a notification.

begin;

-- 1. The handover note lives on the notification (at most 280 characters).
alter table public.notifications add column message text;
alter table public.notifications
  add constraint notifications_message_len
  check (message is null or char_length(message) <= 280);
grant select (message) on public.notifications to authenticated;

-- 2. Two new notification types (both belong to a post).
alter table public.notifications drop constraint notifications_type_valid;
alter table public.notifications drop constraint notifications_post_matches_type;
alter table public.notifications
  add constraint notifications_type_valid
  check (type in (
    'follow', 'like', 'comment', 'reply', 'repost', 'credit',
    'credit_accepted', 'credit_declined', 'note_reply', 'note_like',
    'note_mention', 'note_repost', 'note_quote', 'story_share',
    'comment_mention', 'handover_to_author', 'handover_to_editor'
  ));
alter table public.notifications
  add constraint notifications_post_matches_type
  check ((type in (
    'like', 'comment', 'reply', 'repost', 'credit', 'credit_accepted',
    'credit_declined', 'comment_mention', 'handover_to_author',
    'handover_to_editor'
  )) = (post_id is not null));

-- 3. Two new version labels.
alter table private.post_versions drop constraint post_versions_reason_valid;
alter table private.post_versions
  add constraint post_versions_reason_valid
  check (reason in ('auto', 'publish', 'update', 'restore', 'before_edit', 'edited'));

-- Same function as 0034, only the list of allowed reasons grew.
create or replace function private.save_post_version(p_post_id uuid, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_post public.posts%rowtype;
  v_last private.post_versions%rowtype;
  v_text text;
  v_words integer;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if p_reason is null or p_reason not in
     ('auto', 'publish', 'update', 'restore', 'before_edit', 'edited') then
    raise exception 'history_bad_input';
  end if;
  if not private.can_use_history(p_post_id, v_user) then
    raise exception 'history_not_allowed';
  end if;

  -- Two tabs saving at the same moment must not both write.
  perform pg_advisory_xact_lock(hashtextextended('post_version:' || p_post_id::text, 0));

  select * into v_post from public.posts p where p.id = p_post_id;
  if not found then
    raise exception 'history_not_allowed';
  end if;

  select * into v_last
  from private.post_versions v
  where v.post_id = p_post_id
  order by v.created_at desc, v.id desc
  limit 1;

  if found then
    if v_last.title = v_post.title
       and v_last.subtitle is not distinct from v_post.subtitle
       and v_last.content = v_post.content
       and v_last.language = v_post.language then
      return false;
    end if;
    if p_reason = 'auto' and v_last.created_at > now() - interval '10 minutes' then
      return false;
    end if;
  end if;

  -- All the text of the document, then a word count.
  with recursive walk(node) as (
    select v_post.content
    union all
    select child
    from walk,
         lateral jsonb_array_elements(
           case when jsonb_typeof(walk.node -> 'content') = 'array'
                then walk.node -> 'content' else '[]'::jsonb end
         ) as child
  )
  select string_agg(w.node ->> 'text', ' ')
    into v_text
  from walk w
  where w.node ->> 'type' = 'text';

  v_words := case
    when btrim(coalesce(v_text, '')) = '' then 0
    else array_length(regexp_split_to_array(btrim(v_text), '\s+'), 1)
  end;

  -- A blank first version is not worth keeping.
  if not found and btrim(v_post.title) = '' and v_words = 0 then
    return false;
  end if;

  insert into private.post_versions
    (post_id, saved_by, reason, title, subtitle, content, language, word_count)
  values
    (p_post_id, v_user, p_reason, v_post.title, v_post.subtitle,
     v_post.content, v_post.language, v_words);

  -- Keep the 30 newest.
  delete from private.post_versions d
  where d.post_id = p_post_id
    and d.id not in (
      select v.id from private.post_versions v
      where v.post_id = p_post_id
      order by v.created_at desc, v.id desc
      limit 30
    );

  return true;
end;
$$;

-- 4. Rate limit rule (migration 0007): 30 handovers an hour per user.
insert into private.rate_limit_rules (action, max_hits, window_seconds)
values ('post_handover', 30, 3600)
on conflict (action) do nothing;

-- 5. The handover itself.
-- The owner sends to every accepted editor; an accepted editor sends to the
-- owner. Drafts only. The caller must hold the pen (the app saves the text
-- first). Rule 13: suspended accounts are refused.
create or replace function private.handover_post(p_post_id uuid, p_message text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_post public.posts%rowtype;
  v_msg text;
  v_type text;
  v_reason text;
  v_recipients uuid[];
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  if private.is_suspended() then
    raise exception 'account_suspended' using errcode = '42501';
  end if;

  v_msg := nullif(btrim(coalesce(p_message, '')), '');
  if v_msg is not null and char_length(v_msg) > 280 then
    raise exception 'collab_bad_input';
  end if;

  select * into v_post from public.posts p where p.id = p_post_id;
  if not found then
    raise exception 'collab_post_not_found';
  end if;

  if v_post.status <> 'draft' then
    raise exception 'collab_handover_published';
  end if;

  if v_post.author_id = v_user then
    select array_agg(c.user_id) into v_recipients
    from public.post_collaborators c
    where c.post_id = p_post_id and c.status = 'accepted' and c.role = 'editor';
    if v_recipients is null then
      raise exception 'collab_no_editor';
    end if;
    v_type := 'handover_to_editor';
    v_reason := 'before_edit';
  elsif exists (
    select 1 from public.post_collaborators c
    where c.post_id = p_post_id and c.user_id = v_user
      and c.status = 'accepted' and c.role = 'editor'
  ) then
    v_recipients := array[v_post.author_id];
    v_type := 'handover_to_author';
    v_reason := 'edited';
  else
    raise exception 'collab_not_allowed';
  end if;

  if not exists (
    select 1 from private.post_edit_locks l
    where l.post_id = p_post_id and l.holder_id = v_user
  ) then
    raise exception 'collab_not_holder';
  end if;

  -- The version of the text as it is now. When the newest version is an
  -- identical automatic one, give it the label instead.
  if not private.save_post_version(p_post_id, v_reason) then
    update private.post_versions v
       set reason = v_reason
     where v.id = (
       select x.id from private.post_versions x
       where x.post_id = p_post_id
       order by x.created_at desc, x.id desc
       limit 1
     )
       and v.reason = 'auto';
  end if;

  -- Give the pen back (this also clears a pending turn request).
  delete from private.post_edit_locks l
   where l.post_id = p_post_id and l.holder_id = v_user;

  -- One notification per person and kind: an older one is replaced.
  delete from public.notifications n
   where n.recipient_id = any (v_recipients)
     and n.actor_id = v_user
     and n.type = v_type
     and n.post_id = p_post_id;

  insert into public.notifications (recipient_id, actor_id, type, post_id, message)
  select u.uid, v_user, v_type, p_post_id, v_msg
  from unnest(v_recipients) as u(uid);
end;
$$;

revoke all on function private.handover_post(uuid, text) from public, anon;
grant execute on function private.handover_post(uuid, text) to authenticated;

create or replace function public.handover_post(p_post_id uuid, p_message text)
returns void
language sql
set search_path = ''
as $$
  select private.handover_post(p_post_id, p_message);
$$;

revoke all on function public.handover_post(uuid, text) from public, anon;
grant execute on function public.handover_post(uuid, text) to authenticated;

commit;