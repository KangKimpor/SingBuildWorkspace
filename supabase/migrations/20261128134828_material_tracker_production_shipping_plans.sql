-- D-88: two app-only plan dates on a material, for the timeline's Production finished and Shipped steps.
-- The workbook has no column for them, so they live only in kw_mat_items.edits; this lets the setters accept the keys.
create or replace function kw_private.mat_valid_field(p_key text, p_value jsonb) returns boolean
  language plpgsql immutable set search_path='' as $$
declare
  v_is_null boolean := p_value is null or jsonb_typeof(p_value) = 'null';
begin
  if p_key is null then return false; end if;
  if p_key in ('total','po','shd','onsite','remaining','notYetPo','placed','production','waiting','shipping','arrived') then
    return v_is_null
      or jsonb_typeof(p_value) = 'number'
      or (jsonb_typeof(p_value) = 'string' and length(p_value #>> '{}') between 1 and 60);
  elsif p_key in ('no','code','pic','bp02','location','brand','source','msPlan','msActual','msApproved','msStatus','ssPlan','ssActual','ssApproved','poPlan','poActual','prodPlan','shipPlan','arrPlan','arrActual','unit') then
    return v_is_null
      or (jsonb_typeof(p_value) = 'string' and length(p_value #>> '{}') between 0 and 200);
  elsif p_key in ('description','spec','procRemarks') then
    return v_is_null
      or (jsonb_typeof(p_value) = 'string' and length(p_value #>> '{}') between 0 and 2000);
  elsif p_key in ('image','sample') then
    return v_is_null
      or (
        jsonb_typeof(p_value) = 'array'
        and jsonb_array_length(p_value) <= 10
        and not exists (
          select 1
          from jsonb_array_elements(p_value) as el(e)
          where jsonb_typeof(el.e) <> 'string'
             or (el.e #>> '{}') like '%..%'
             or not (
               (el.e #>> '{}') ~ '^[a-f0-9]{1,64}\.(webp|png|jpg|jpeg)$'
               or (el.e #>> '{}') ~ '^storage:[a-zA-Z0-9._/-]{1,200}$'
             )
        )
      );
  else
    return false;
  end if;
end $$;
revoke all on function kw_private.mat_valid_field(text, jsonb) from public, anon, authenticated;
