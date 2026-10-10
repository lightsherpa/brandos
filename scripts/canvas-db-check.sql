-- Run against an isolated migrated PostgreSQL database. All fixtures roll back.
begin;
insert into auth.users(id) values ('00000000-0000-4000-8000-000000000001');
insert into workspaces(id) values ('00000000-0000-4000-8000-000000000002'),('00000000-0000-4000-8000-000000000003');
insert into brands(id,workspace_id) values ('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000002');
insert into briefs(id,brand_id) values ('00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000004');
insert into canvas_layouts(id,workspace_id,brand_id,brief_id,created_by,document)
values ('00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000001','{"nodes":[],"edges":[]}');
insert into canvas_proposals(id,canvas_id,base_revision,document,summary,created_by)
values ('00000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000006',0,'{"applied":true}','Proposal','00000000-0000-4000-8000-000000000001');
select * from apply_canvas_proposal('00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000001');
select * from apply_canvas_proposal('00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000001');
do $$ begin
  if (select revision from canvas_layouts where id='00000000-0000-4000-8000-000000000006') <> 1 then raise exception 'Proposal replay incremented revision'; end if;
  if has_table_privilege('authenticated','canvas_layouts','UPDATE') then raise exception 'Authenticated layout write authority'; end if;
  if has_table_privilege('authenticated','canvas_quotes','SELECT') then raise exception 'Internal quote data readable'; end if;
  if has_function_privilege('authenticated','apply_canvas_proposal(uuid,uuid,uuid)','EXECUTE') then raise exception 'Public proposal execution authority'; end if;
end $$;
-- A stale proposal must fail without marking itself applied.
insert into canvas_proposals(id,canvas_id,base_revision,document,summary,created_by)
values ('00000000-0000-4000-8000-000000000008','00000000-0000-4000-8000-000000000006',0,'{}','Stale proposal','00000000-0000-4000-8000-000000000001');
do $$ declare failed boolean := false; begin
  begin perform apply_canvas_proposal('00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000008','00000000-0000-4000-8000-000000000001'); exception when others then failed := true; end;
  if not failed then raise exception 'Stale proposal accepted'; end if;
  if (select applied_at from canvas_proposals where id='00000000-0000-4000-8000-000000000008') is not null then raise exception 'Failed proposal consumed'; end if;
end $$;
insert into runs(id,brief_id,status,canvas_id,canvas_node_id) values ('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000005','running','00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000011');
do $$ declare failed boolean := false; begin
  begin insert into runs(id,brief_id,status,canvas_id,canvas_node_id) values ('00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000005','running','00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000011'); exception when unique_violation then failed := true; end;
  if not failed then raise exception 'Concurrent active node runs accepted'; end if;
end $$;
-- The bootstrap's permission function reads test.workspace to simulate tenant claims.
select set_config('test.workspace','00000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ begin if (select count(*) from canvas_layouts) <> 0 then raise exception 'Foreign tenant layout leak'; end if; end $$;
reset role;
select set_config('test.workspace','00000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin if (select count(*) from canvas_layouts) <> 1 then raise exception 'Own tenant cannot read layout'; end if; end $$;
reset role;
rollback;
