# Repository Guidelines

This guide tracks how we grow Unified Sovereign Estate from an empty skeleton into a dependable platform. Update it whenever tooling or processes change so newcomers land on the current source of truth.

## Project Structure & Module Organization
- Create `src/` for all runtime modules; group code by bounded context (e.g., `src/register/`, `src/ledger/`).
- Mirror every runtime package inside `tests/` using the same namespace so fixtures live next to the code they verify.
- Keep infrastructure and deployment assets in `infra/` (Terraform, CD workflows) and long-form notes in `docs/`.
- Store shared assets—seed data, media, schema snapshots—inside `assets/` with subfolders per domain.

## Build, Test, and Development Commands
Standardize entry points through a `Makefile` (or `Justfile`) so every agent runs the same flows:
- `make bootstrap` — install dependencies and configure pre-commit hooks.
- `make dev` — start the local stack (API, workers, UI) with live reload.
- `make lint` — run formatters and static analyzers; fail fast on warnings.
- `make test` — execute the full automated suite; aggregate unit, integration, and contract results.
Document service-specific commands in `docs/runbooks/` as they appear.

## Coding Style & Naming Conventions
- Default to 4-space indentation for backend code and 2 spaces for JSON/YAML.
- Use snake_case for files and functions, PascalCase for classes, and kebab-case for CLI scripts.
- Run `ruff` and `black` for Python or `prettier` for JS/TS before committing; wire them into `make lint`.
- Capture configuration in `.env` files and maintain `.env.example` with safe sample values.

## Testing Guidelines
- Use pytest for Python logic and Playwright for browser or end-to-end flows; keep coverage ≥85%.
- Name test files `test_<module>.py`; house shared fixtures in `tests/fixtures/`.
- Document integration setup steps in `tests/README.md` and link any external services.
- Run `make test` (optionally `pytest -m "not slow"`) before pushing feature branches.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (`feat:`, `fix:`, `chore:`) with ≤72-character subjects and detailed bodies.
- Reference issue IDs (`Refs #123`) and attach screenshots or logs for user-facing changes.
- Keep PRs narrowly scoped, list risks and verification steps, and ensure CI passes before requesting review.
- Convert PRs to draft when work continues to avoid premature reviews.

## Security & Configuration Tips
- Store secrets locally in `.env`; never commit them. Provide redacted examples in `.env.example`.
- Rotate credentials when collaborators cycle off and audit dependency locks quarterly.
- Gate production credentials behind SSO-managed vaults; document retrieval steps in `docs/security.md`.
- First think through the problem, read the codebase for relevant files, and write a plan to tasks/todo.md.
## General Agent rules
- The plan should have a list of todo items that you can check off as you complete them
- Before you begin working, check in with me and I will verify the plan.
- Then, begin working on the todo items, marking them as complete as you go.
- Please every step of the way just give me a high level explanation of what changes you made
- Make every task and code change you do as simple as possible. We want to avoid making any massive or complex changes. Every change should impact as little code as possible. Everything is about simplicity.
- Finally, add a review section to the todo.md file with a summary of the changes you made and any other relevant information.
- DO NOT BE LAZY. NEVER BE LAZY. IF THERE IS A BUG FIND THE ROOT CAUSE AND FIX IT. NO TEMPORARY FIXES. YOU ARE A SENIOR DEVELOPER. NEVER BE LAZY
- MAKE ALL FIXES AND CODE CHANGES AS SIMPLE AS HUMANLY POSSIBLE. THEY SHOULD ONLY IMPACT NECESSARY CODE RELEVANT TO THE TASK AND NOTHING ELSE. IT SHOULD IMPACT AS LITTLE CODE AS POSSIBLE. YOUR GOAL IS TO NOT INTRODUCE ANY BUGS. IT'S ALL ABOUT SIMPLICITY