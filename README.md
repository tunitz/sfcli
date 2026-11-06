# sfcli

A fast, static command reference for Salesforce CLI (`sf`). Search all commands by name, flags, examples, or plain-English intent. Save favorites locally, copy command examples, and follow common workflows.

## Features

- Full command inventory generated from Salesforce CLI JSON output; hidden commands excluded.
- Fuzzy search across command IDs, descriptions, flags, flag descriptions and example invocations.
- Flag and argument help is available through the details control on each card.
- Recognized CLI shell examples are copyable in one click — one shows by default. Prose-only examples are omitted.
- Full help text for every command: descriptions clamp to two lines with a "Show full description" toggle
  and flags and examples expand the same way.
- Favorites lead every list — they float to the top of the category, search or all-commands view
  they belong to (and never appear in categories they don't belong to); recent searches and theme
  preference are stored in this browser only.
- Curated workflows for authenticating, checking an org, creating a project, deploying metadata, querying records, and opening an org.
- Collapsible sidebar (whole panel plus workspace/CATEGORIES sections) and clickable breadcrumbs for
  moving between views; the sidebar state persists in this browser.
- Static Vite build; no API or runtime server required.

## Run locally

Requires Bun 1.2+.

```sh
bun install
bun run dev
bun run build
bun run preview
```

## Command data

The checked-in `src/data/commands.json` is a static snapshot. To refresh it locally, install a current Salesforce CLI separately (its Node.js runtime requirement applies; the workflow uses Node 24) and run:

```sh
bun test
bun run scripts/refresh-commands.ts
bun run build
```

The generator runs `sf commands --json` (no org login is needed), excludes hidden commands and flags and global flags, and retains summaries, descriptions, flags, arguments and recognized shell examples. It resolves the common oclif `config.bin` and `command.id` example templates and separates prose prefixes from commands; prose-only examples are omitted. Output is sorted and contains no generation timestamp. A failed CLI, unexpected JSON, duplicate IDs, or a drop of over 20% in commands, flags, arguments, descriptions or examples aborts without replacing the snapshot. Inspect the resulting diff: this guard is not a guarantee of completeness, and command availability depends on the installed plugins. The script writes a temporary file next to the snapshot and atomically renames it after validation.

The `Refresh Salesforce CLI data` GitHub Actions workflow runs weekly and can also be started with **Actions → Run workflow**. It installs the latest Salesforce CLI, validates the snapshot and build, and commits changed data directly to the repository's default branch. It uses the built-in `GITHUB_TOKEN` with `contents: write`; repository Actions settings and branch protection must allow this push. Concurrent changes or protected branches cause the push to fail rather than overwrite work. No additional secret is required. A commit made with `GITHUB_TOKEN` normally does not trigger another GitHub Actions workflow: verify that the site's deployment integration deploys these commits, or configure a separately authorized deployment mechanism. The workflow cannot update a live site until it is pushed to GitHub and those settings are in place.

The app is community-maintained and is not affiliated with Salesforce. Command availability can vary by installed plugins and CLI version; use `sf <command> --help` for the canonical local help.
