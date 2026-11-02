-- Chat archive retention: keep the last 30 days, delete everything older, every night.
-- Run once in the Supabase SQL editor of the CHAT project (not the bot's project). Safe to re-run.

-- 1. The prune function.
--
-- Re-created rather than reused, to fix two things in the original:
--   * it was callable by anyone. Functions in the public schema are executable by PUBLIC by
--     default and Supabase exposes them as /rest/v1/rpc/<name>, so anyone holding the anon key
--     could have called prune_chat(0) and emptied the archive. Execute is revoked below.
--   * a typo'd or hostile small value would wipe everything; it now refuses anything under 7 days.
--
-- It also trims pg_cron's own run log, which gains a row every time the collector fires
-- (~720 a day) and is never cleaned up by itself.
create or replace function public.prune_chat(days integer default 30)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare removed integer;
begin
  if days is null or days < 7 then
    raise exception 'prune_chat refuses to keep fewer than 7 days (got %)', days;
  end if;

  delete from public.chat_messages where seen_at < now() - days * interval '1 day';
  get diagnostics removed = row_count;

  delete from public.chat_gaps where noticed_at < now() - days * interval '1 day';
  delete from cron.job_run_details where end_time < now() - interval '7 days';

  return removed;
end $$;

revoke execute on function public.prune_chat(integer) from public, anon, authenticated;

-- 2. Run it every day at 04:00 UTC. Scheduling under the same name replaces any earlier job,
--    so re-running this file never creates a duplicate.
select cron.schedule('prune-chat', '0 4 * * *', $$ select public.prune_chat(30) $$);

-- 3. Check it took (each should return one row):
--    select jobname, schedule, command, active from cron.job where jobname = 'prune-chat';
--    select has_function_privilege('anon', 'public.prune_chat(integer)', 'execute');  -- must be false
--
-- After the first nightly run, see what it did:
--    select status, return_message, start_time from cron.job_run_details
--    where jobid = (select jobid from cron.job where jobname = 'prune-chat')
--    order by start_time desc limit 5;
--
-- Storage: Postgres reuses the space freed by deleted rows rather than shrinking the database, so
-- the size reported by Supabase stops growing at roughly a month's worth instead of dropping.
--    select pg_size_pretty(pg_total_relation_size('public.chat_messages'));
