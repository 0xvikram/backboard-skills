# Contributing

Thanks for helping hackers build faster. This guide covers improving a skill, adding a tested one, and how review works.

## Improve your tool's skill (tool teams)

Every tool on [the board](https://backboard.0xvikram.me) has a skill at `skills/<tool>/SKILL.md`. Most start as **generated** skills: links and facts, no code. You can replace yours with a richer, hand-written one.

1. Fork the repo and edit `skills/<tool>/`.
2. **Delete the line `<!-- backboard:generated -->`.** That marks the skill as hand-written, so Backboard never overwrites it.
3. Keep `name` in the front matter the same as the folder name.
4. Follow the structure below, run the checks, and open a pull request using the template.

To confirm you're on the team, open the pull request from an account linked to your organisation, or mention an official account or docs page in the description.

## Structure of a tested skill

```text
skills/<tool>/
  SKILL.md                 required: front matter + short instructions (aim for under ~120 lines)
  references/
    quickstart.md          setup, env vars, a complete runnable example
    recipes.md             5–8 things hackers build with the tool, with code
    errors.md              common errors and their fixes
    chains.md              sponsor chains it supports (only if it does)
    mcp.md                 MCP server setup (only if it has one)
```

`SKILL.md` front matter:

```yaml
---
name: <tool>                       # same as the folder; lowercase, numbers, hyphens
description: "What the tool is and when to use this skill (max 1024 characters)."
license: MIT
metadata:
  category: "Wallets & onboarding" # a category from the board
  website: "https://example.com"
  source: "tested"
  tested: "2026-10-20"             # the date you last ran the examples
  packages: "example-sdk@1.2.3"    # what you tested with
---
```

Link reference files from `SKILL.md` with relative links (`[recipes](references/recipes.md)`), so the assistant loads them only when needed.

## Tests for a tested skill

A skill marked `source: "tested"` must include `tests/` so anyone can re-run its checks with `node scripts/verify.mjs <tool>`:

- `package.json` with exact versions (no `^`) and npm scripts: `typecheck` (required), `live` (key-free checks against public services; exit 75 when a service can't be reached), `build` (optional, runs with `--full`).
- `tsconfig.json` that includes `blocks/`: the runner writes every code block from your SKILL.md and references there, so the code people copy is the code that gets checked.
- `README.md` saying what is and isn't checked. Mark a code block that can't stand alone with `<!-- verify:skip -->` on the line above it, and say why.

No keys, wallets with funds, Docker or global installs. Look at `skills/privy/tests/` for an example.

## Rules every skill must follow

- **Current and official.** Base code on the tool's current official docs and link to them. Pin the versions you tested.
- **Tested.** Install the packages in a clean folder and at least type-check or run the examples. Say what you ran in the pull request.
- **Safe.** No piped install scripts (`curl … | sh`), no commands that run without the user asking, no telemetry, no secrets. Use placeholders like `<YOUR_API_KEY>`.
- **No prize rules.** Link to [ETHGlobal's prize page](https://ethglobal.com/events/mumbai/prizes); don't restate rules or amounts.
- **Plain and factual.** Short sentences. No marketing claims, no comparisons with other tools.

## Run the checks

No install needed, just Node 18 or later:

```bash
node scripts/validate.mjs   # front matter, names, file links, blocked patterns
node scripts/catalog.mjs    # rebuilds the catalog in README.md
node scripts/links.mjs      # checks every web link still loads (optional)
```

Pull requests run the first two automatically.

## Review

The maintainer reviews every pull request ([CODEOWNERS](.github/CODEOWNERS)). Expect a reply within two days, faster in the week of the hackathon. We may ask for a source link or a test before merging.

## Remove a skill

If you're on a tool's team and want its skill taken down, [open a team issue](https://github.com/0xvikram/backboard-skills/issues/new/choose) or message [@vikram_twt](https://x.com/vikram_twt).

## Report something harmful

See [SECURITY.md](SECURITY.md). Please report privately.
