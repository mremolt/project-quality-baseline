-- Local only (NEST-DEV-04): the production role split with throwaway passwords. Runs once, on an empty data volume.
-- DDL user: owns the database and its public schema, used only by migrations (NEST-DB-17).
CREATE ROLE orders_owner LOGIN PASSWORD 'orders_owner';
-- DML user: the application pool; gets its privileges from the first migration.
CREATE ROLE orders_app LOGIN PASSWORD 'orders_app';
ALTER DATABASE orders OWNER TO orders_owner;
