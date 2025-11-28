-- Função para preencher campos de auditoria quando owner salva
create or replace function set_owner_audit_on_pricing_table()
returns trigger
language plpgsql
security definer
as $$
declare
  v_user_email text;
  v_user_role text;
begin
  -- Capturar email e role do JWT
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';
  v_user_role := current_setting('request.jwt.claims', true)::jsonb->>'role';

  -- Se o modificador for o próprio owner (não admin), atualizar campos de auditoria
  if lower(new.owner_email) = lower(v_user_email) and (v_user_role is null or v_user_role != 'admin') then
    new.last_modified_by := v_user_email;
    new.last_modified_at := now();
    new.last_modified_by_type := 'owner';
  end if;

  return new;
end;
$$;

-- Trigger BEFORE para capturar modificações do owner
drop trigger if exists trigger_set_owner_audit on public.pricing_tables;
create trigger trigger_set_owner_audit
  before insert or update on public.pricing_tables
  for each row
  execute function set_owner_audit_on_pricing_table();
