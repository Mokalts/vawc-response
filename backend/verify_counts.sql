-- Row counts for every table, for checking one database against another.
--
-- Run it against the old database and the new one after a migration and
-- compare the two outputs line by line. They should be identical. Anything
-- that differs is a table that did not come across.
--
--   psql "<connection string>" -f backend/verify_counts.sql
--
-- It only counts rows, so it is safe to run against production and it reads
-- no case data.

select 'admins'             as table_name, count(*) as rows from admins
union all select 'barangay_officials', count(*) from barangay_officials
union all select 'bpos',               count(*) from bpos
union all select 'case_activities',    count(*) from case_activities
union all select 'case_messages',      count(*) from case_messages
union all select 'cases',              count(*) from cases
union all select 'children',           count(*) from children
union all select 'deletion_records',   count(*) from deletion_records
union all select 'endorsements',       count(*) from endorsements
union all select 'hotlines',           count(*) from hotlines
union all select 'otps',               count(*) from otps
union all select 'reports',            count(*) from reports
union all select 'user_activities',    count(*) from user_activities
union all select 'users',              count(*) from users
order by table_name;
