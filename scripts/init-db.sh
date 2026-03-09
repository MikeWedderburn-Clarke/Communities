#!/bin/bash
# Docker entrypoint init script: creates the live + test databases on first start.
# Mounted at /docker-entrypoint-initdb.d/init-db.sh in docker-compose.yml.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
  SELECT 'CREATE DATABASE communities'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'communities')\gexec
  SELECT 'CREATE DATABASE communities_test'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'communities_test')\gexec
EOSQL
