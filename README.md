# AIDeck

AIDeck project repository.

## Getting Started

Clone the repository, then add the project code and dependency configuration. Update this file once the project's purpose, technology stack, and setup steps are defined.

## Repository Guidelines

- Do not commit secrets, tokens, or `.env` files containing real credentials.
- Use `.editorconfig` to keep basic text formatting consistent.
- Update `.gitignore` for generated files when adding a language or tool.
- Keep repository files and Git messages in English.
- Only the root `README.md` is tracked among Markdown files.

## Git Conventions

### Commit messages

Use this title format:

```text
<type>(<scope>): <imperative summary>
```

Use lowercase `type` and `scope`. Keep the title at or below 72 characters, start the summary with an imperative verb, and omit the final period. The scope is a short name for the affected area, such as `deck`, `export`, or `repo`.

Allowed types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`, and `revert`.

For commits that need explanation, leave a blank line after the title and use this body format:

```text
Why:
- Explain the reason for the change.

Changes:
- Summarize the main changes.

Validation:
- State what was checked, or write "Not run" with a reason.
```

Example title: `feat(deck): add slide export`.

The repository includes a `.gitmessage` template. To use it in a clone, run `git config --local commit.template .gitmessage`.

### Branch names

Create branches from the latest `main` and name them `<type>/<short-kebab-description>`. Use an allowed commit type, lowercase English words, digits when needed, and hyphens between words. If there is an issue number, put it first in the description: `feat/123-slide-export`.

Examples: `feat/slide-export`, `fix/empty-deck-export`, `docs/update-setup`.

## Status

Project initialization in progress.
