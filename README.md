# sfcli

A fast, static command reference for Salesforce CLI (`sf`). Search all commands by name, flags, examples, or plain-English intent. Save favorites locally, copy command examples, and follow common workflows.

## Features

- Full command inventory generated from Salesforce CLI JSON output; hidden commands excluded.
- Fuzzy search across command IDs, descriptions, flags, flag descriptions and example invocations.
- Every flag for a command (up to 28) with its help text, one click away — cards show the first four.
- Every example the CLI ships for a command (up to 16), copyable in one click — one shows by default.
- Full help text for every command: descriptions clamp to two lines with a "Show full description" toggle
  (up to 2,500 characters), flags and examples expand the same way.
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

The checked-in `src/data/commands.json` was generated from `sf commands --json` using the Salesforce CLI (2.151.7): each entry keeps the command's official summary, help description, every non-global flag with its one-line help text, the complete help description, and all of its examples (756). To refresh it with a current Salesforce CLI installation:

```sh
sf commands --json > commands.json   # then trim to id/summary/description/flags/args/examples
```

oclif example templates are resolved at build time (`<%= config.bin %>` → `sf`, `<%= command.id %>` → the command), and examples written as `"What this does: sf some command"` are split so the copy button yields just the command.

The app is community-maintained and is not affiliated with Salesforce. Command availability can vary by installed plugins and CLI version; use `sf <command> --help` for the canonical local help.
