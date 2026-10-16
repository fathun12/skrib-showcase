-- 0098_editor_publish.sql
-- Run after 0097.
-- Editorial, round E4: the author may allow an editor to publish.
begin;

alter table public.post_collaborators
  add column can_publish boolean not null default false;

alter table public.post_collaborators
  add constraint post_collaborators_publish_editor_only
  check (not can_publish or role = 'editor');

-- The author switches the right on or off (no UPDATE grant exists).
create function private.set_editor_can_publish(
  p_post_id uuid,
  p_user_id uuid,
  p_can_publish boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null
     or not exists (
       select 1 from public.posts p
       where p.id = p_post_id and p.author_id = v_user
     ) then
    raise exception 'collab_not_allowed';
  end if;

  if private.is_suspended() then
    raise exception 'account_suspended' using errcode = '42501';
  end if;

  update public.post_collaborators c
  set can_publish = p_can_publish
  where c.post_id = p_post_id
    and c.user_id = p_user_id
    and c.role = 'editor';

  if not found then
    raise exception 'collab_editor_not_found';
  end if;
end;
$$;

create function public.set_editor_can_publish(
  p_post_id uuid,
  p_user_id uuid,
  p_can_publish boolean
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.set_editor_can_publish(p_post_id, p_user_id, p_can_publish);
$$;

-- An editor with the right publishes a DRAFT. Slug, cover and topics stay as
-- the author left them. No newsletter, no schedule.
create function private.editor_publish_post(p_post_id uuid, p_slug text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_status text;
  v_title text;
  v_owner uuid;
begin
  if v_user is null then
    raise exception 'collab_not_allowed';
  end if;

  if private.is_suspended() then
    raise exception 'account_suspended' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.post_collaborators c
    where c.post_id = p_post_id
      and c.user_id = v_user
      and c.status = 'accepted'
      and c.role = 'editor'
      and c.can_publish
  ) then
    raise exception 'collab_not_allowed';
  end if;

  select p.status, p.title, p.author_id
    into v_status, v_title, v_owner
  from public.posts p
  where p.id = p_post_id
  for update;

  if not found then
    raise exception 'collab_not_allowed';
  end if;
  if v_status = 'hidden' then
    raise exception 'collab_post_hidden';
  end if;
  if v_status <> 'draft' then
    raise exception 'collab_not_draft';
  end if;
  if btrim(v_title) = '' then
    raise exception 'collab_title_required';
  end if;

  if not exists (
    select 1 from private.post_edit_locks l
    where l.post_id = p_post_id and l.holder_id = v_user
  ) then
    raise exception 'collab_not_holder';
  end if;

  if p_slug is null
     or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     or length(p_slug) > 100 then
    raise exception 'collab_bad_input';
  end if;

  update public.posts
  set status = 'published',
      published_at = now(),
      slug = p_slug
  where id = p_post_id;

  -- The pen goes back (same as a handover).
  delete from private.post_edit_locks
  where post_id = p_post_id and holder_id = v_user;

  -- Tell the author. The older row of the same kind goes first (dedupe index).
  delete from public.notifications
  where recipient_id = v_owner
    and actor_id = v_user
    and type = 'editor_published'
    and post_id = p_post_id;

  insert into public.notifications (recipient_id, actor_id, type, post_id)
  values (v_owner, v_user, 'editor_published', p_post_id);
end;
$$;

create function public.editor_publish_post(p_post_id uuid, p_slug text)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.editor_publish_post(p_post_id, p_slug);
$$;

revoke all on function private.set_editor_can_publish(uuid, uuid, boolean) from public, anon;
grant execute on function private.set_editor_can_publish(uuid, uuid, boolean) to authenticated;
revoke all on function public.set_editor_can_publish(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_editor_can_publish(uuid, uuid, boolean) to authenticated;
revoke all on function private.editor_publish_post(uuid, text) from public, anon;
grant execute on function private.editor_publish_post(uuid, text) to authenticated;
revoke all on function public.editor_publish_post(uuid, text) from public, anon;
grant execute on function public.editor_publish_post(uuid, text) to authenticated;

-- New notification type: BOTH constraints recreated with the full list.
alter table public.notifications drop constraint notifications_type_valid;
alter table public.notifications add constraint notifications_type_valid
  check (type = any (array[
    'follow', 'like', 'comment', 'reply', 'repost', 'credit',
    'credit_accepted', 'credit_declined', 'note_reply', 'note_like',
    'note_mention', 'note_repost', 'note_quote', 'story_share',
    'comment_mention', 'handover_to_author', 'handover_to_editor',
    'editor_published'
  ]));

alter table public.notifications drop constraint notifications_post_matches_type;
alter table public.notifications add constraint notifications_post_matches_type
  check ((type = any (array[
    'like', 'comment', 'reply', 'repost', 'credit', 'credit_accepted',
    'credit_declined', 'comment_mention', 'handover_to_author',
    'handover_to_editor', 'editor_published'
  ])) = (post_id is not null));

commit;