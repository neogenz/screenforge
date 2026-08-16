.DEFAULT_GOAL := help

.PHONY: help dev dev-backend preview build typecheck lint test test-unit test-e2e test-release audit-contrast validate-export

help:
	@printf '%s\n' \
		'ScreenForge workflows:' \
		'  make dev                         Start the development server' \
		'  make dev-backend                 Start the local Convex deployment' \
		'  make preview                     Preview the production build' \
		'  make build                       Build the production application' \
		'  make typecheck                   Check TypeScript types' \
		'  make lint                        Run ESLint' \
		'  make test                        Run unit tests, typecheck, and lint' \
		'  make test-unit                   Run unit tests' \
		'  make test-e2e                    Run Playwright end-to-end tests' \
		'  make test-release                Run the complete release validation' \
		'  make audit-contrast              Audit UI contrast ratios' \
		'  make validate-export FILE=<archive.zip>  Validate an exported ZIP archive'

dev:
	pnpm run dev

dev-backend:
	pnpm run dev:backend

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

validate-export:
	pnpm run validate:export -- "$(FILE)"
