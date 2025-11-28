-- Função para criar notificação quando admin edita tabela
create or replace function notify_on_admin_table_edit()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Só notifica se foi editado por admin
  if new.last_modified_by_type = 'admin' then
    insert into public.notifications (
      recipient_email,
      type,
      title,
      message,
      data
    )
    values (
      new.owner_email,
      'table_modified_by_admin',
      'Tabela editada por administrador',
      'Um administrador modificou sua tabela de preços',
      jsonb_build_object(
        'table_id', new.id,
        'admin_email', new.last_modified_by,
        'modified_at', new.last_modified_at
      )
    );
  end if;
  return new;
end;
$$;

-- Trigger após insert ou update em pricing_tables
drop trigger if exists trigger_notify_admin_edit on public.pricing_tables;
create trigger trigger_notify_admin_edit
  after insert or update on public.pricing_tables
  for each row
  execute function notify_on_admin_table_edit();
