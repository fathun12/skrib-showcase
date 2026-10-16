begin;

create or replace function public.publish_due_posts(p_limit integer default 25)
returns table(o_post_id uuid, o_author_id uuid, o_send_email boolean, o_tags text[])
language plpgsql
security definer
set search_path to ''
as $function$
declare
  r record;
begin
  for r in
    select p.id, p.author_id, p.schedule_email, p.tags
    from public.posts p
    where p.status = 'draft'
      and p.scheduled_for is not null
      and p.scheduled_for <= now()
    order by p.scheduled_for, p.id
    limit greatest(1, least(coalesce(p_limit, 25), 100))
    for update skip locked
  loop
    begin
      -- Act as the author, so the suspension check and the guard triggers
      -- see the same user as a normal publish.
      perform set_config('request.jwt.claim.sub', r.author_id::text, true);
      perform set_config(
        'request.jwt.claims',
        json_build_object('sub', r.author_id)::text,
        true
      );

      if private.is_suspended() then
        continue;
      end if;

      update public.posts
      set status = 'published', published_at = now()
      where id = r.id
        and status = 'draft'
        and btrim(title) <> '';

      if found then
        o_post_id := r.id;
        o_author_id := r.author_id;
        o_send_email := r.schedule_email;
        o_tags := r.tags;
        return next;
      else
        -- A blank title cannot be published: drop the schedule, so the post
        -- is not picked again at every run.
        update public.posts
        set scheduled_for = null, schedule_email = false
        where id = r.id
          and status = 'draft'
          and coalesce(btrim(title), '') = '';
      end if;
    exception
      when others then
        null;
    end;
  end loop;
  return;
end;
$function$;

commit;