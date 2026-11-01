-- 20261101100000 rebuilt the writer from its 20261027151037 body, which predates the
-- baseline-reset guard added by 20261029041654. Restore it so an offline autosave saved before
-- an administrative reset still cannot write old progress back. Idempotent: it only inserts the
-- guard when the function does not already raise it.
do $$
declare definition text;
  marker text := 'if activity.id is null or activity.data->>''editable''<>''true''';
  guard text := 'if activity.data->>''baselineResetAt'' is not null and (nullif(entry->>''baseRevision'','''') is null or (entry->>''baseRevision'')::timestamptz < (activity.data->>''baselineResetAt'')::timestamptz) then raise exception ''BP03 baseline was reset. Reload before updating progress''; end if; ';
begin
  select pg_get_functiondef('kw_private.nbc_submission_write(text,jsonb,timestamptz)'::regprocedure) into definition;
  if position(marker in definition)=0 then raise exception 'Unexpected submission validator; review reset guard'; end if;
  if position('BP03 baseline was reset' in definition)>0 then return; end if;
  execute replace(definition, marker, guard || marker);
end $$;
