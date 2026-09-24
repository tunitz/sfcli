# sfcli

A fast, static command reference for Salesforce CLI (`sf`). Search all commands by name, flags, examples, or plain-English intent. Save favorites locally, copy command examples, and follow common workflows.

## Features

- Full command inventory generated from Salesforce CLI JSON output; hidden commands excluded.
- Fuzzy search across command IDs, descriptions, flags, and examples.
- Favorites, recent commands/searches, and theme preference stored in this browser only.
- Curated workflows for authenticating, checking an org, creating a project, deploying metadata, querying records, and opening an org.
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

The checked-in `src/data/commands.json` was generated from `sf commands --json` using the Salesforce CLI (2.151.7) and includes each command's official summary, help description, flags, arguments, and examples. To refresh it with a current Salesforce CLI installation:

```sh
sf commands --json > src/data/commands.json
```

This app is community-maintained and is not affiliated with Salesforce. Command availability can vary by installed plugins and CLI version; use `sf <command> --help` for the canonical local help.
