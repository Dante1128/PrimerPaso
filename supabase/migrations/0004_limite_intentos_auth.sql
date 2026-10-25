-- Límite de intentos en /api/auth/* por IP y por correo (ventana fija).
-- Vive en Postgres para que funcione igual con varias instancias (serverless).

create table if not exists public.auth_rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  hits integer not null default 0
);

alter table public.auth_rate_limits enable row level security;

-- Suma un intento a `p_key` y devuelve true si sigue dentro del límite.
-- Si la ventana venció, empieza una nueva. De vez en cuando borra claves viejas.
create or replace function public.auth_rate_limit_hit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hits integer;
begin
  insert into public.auth_rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update
    set hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
        window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;

  if random() < 0.01 then
    delete from public.auth_rate_limits where window_start < now() - interval '1 hour';
  end if;
  return v_hits <= p_max;
end;
$$;

-- Solo el servidor (service_role) cuenta intentos.
revoke all on function public.auth_rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.auth_rate_limit_hit(text, integer, integer) to service_role;
