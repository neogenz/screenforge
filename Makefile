.DEFAULT_GOAL := help

.PHONY: help dev preview build typecheck lint test test-unit test-e2e test-release audit-contrast validate-export db-start db-stop db-migrate

help:
	@printf '%s\n' \
		'ScreenForge workflows:' \
		'  make dev                         Start the development server' \
		'  make preview                     Preview the production build' \
		'  make build                       Build the production application' \
		'  make typecheck                   Check TypeScript types' \
		'  make lint                        Run ESLint' \
		'  make test                        Run unit tests, typecheck, and lint' \
		'  make test-unit                   Run unit tests' \
		'  make test-e2e                    Run Playwright end-to-end tests' \
		'  make test-release                Run the complete release validation' \
		'  make audit-contrast              Audit UI contrast ratios' \
		'  make db-start                    Start the local Supabase stack (Docker)' \
		'  make db-migrate                  Apply migrations to the local database' \
		'  make db-stop                     Stop the local Supabase stack' \
		'  make validate-export FILE=<archive.zip>  Validate an exported ZIP archive'

dev:
	pnpm run dev

preview:
	pnpm run preview

build:
	pnpm run build

typecheck:
	pnpm run typecheck

lint:
	pnpm run lint

test:
	pnpm run test

test-unit:
	pnpm run test:unit

test-e2e:
	pnpm run test:e2e

test-release:
	pnpm run test:release

audit-contrast:
	pnpm run audit:contrast

db-start:
	pnpm run db:start

db-migrate:
	pnpm run db:migrate

db-stop:
	pnpm run db:stop

validate-export:
	pnpm run validate:export -- "$(FILE)"
