# Backboard skills

Open-source AI skills for the developer tools on [Backboard](https://backboard.0xvikram.me), the free, unofficial toolbox for hackers at ETHGlobal Mumbai (5 to 7 Nov 2026).

Install one and your AI coding assistant (Claude Code, Cursor, Codex and [many others](https://github.com/vercel-labs/skills#supported-agents)) knows where that tool's real docs, AI docs and MCP server are, which chains and prize tracks it fits, and where to ask its team for help.

## Install

Run this in your project folder:

```bash
# one tool
npx skills add 0xvikram/backboard-skills --skill privy

# several tools at once
npx skills add 0xvikram/backboard-skills --skill privy --skill thirdweb

# the Backboard skill: suggests tools for what you're building, from the live board
npx skills add 0xvikram/backboard-skills --skill backboard

# see every skill
npx skills add 0xvikram/backboard-skills --list
```

Every card on [the board](https://backboard.0xvikram.me) has an **Install skill** button that copies the right command.

## What's in a skill

Each tool has its own folder: `skills/<tool>/SKILL.md`.

- **Generated skills** are written when a tool is approved on the board. They contain no code: they point your assistant at the tool's own docs for AI, its MCP server and its full docs, then add the hackathon facts from its listing. So they can't teach your assistant a wrong API.
- **Hand-written skills** go further, with quickstarts, versions and the errors people hit. They are tested before they're added.

When a skill and the tool's own docs disagree, the docs win.

## For tool teams

Your tool's skill is yours to improve. See [CONTRIBUTING.md](CONTRIBUTING.md).

## About

Backboard is an independent project by [Vikram](https://x.com/vikram_twt). It is not affiliated with, run by or endorsed by ETHGlobal or any of its sponsors. Prize rules and details are only on [ETHGlobal's prize page](https://ethglobal.com/events/mumbai/prizes).

MIT licensed.
