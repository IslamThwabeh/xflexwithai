# Pre-existing technical debt: fresh D1 bootstrap

Status: open; explicitly outside Live Package Phase A.

The historical numbered migration chain cannot bootstrap a blank SQLite/D1 database. `database/migrations/002_add_quiz_system.sql` contains PostgreSQL-oriented DDL, including unsupported `COMMENT ON TABLE` statements, so a fresh replay fails before reaching migration 097.

Do not rewrite migration 002 as part of a feature release. Handle this separately by designing and validating a baselined D1 bootstrap or a narrowly scoped historical-chain repair. Migration 097 must continue to be tested from reconciled production DDL with minimal synthetic rows.
