# Security

A skill is a set of instructions an AI coding assistant follows on someone's machine. A harmful skill could make an assistant run unsafe commands, leak secrets or send funds somewhere they shouldn't go. We treat that as a security issue.

## Report a problem

Please report privately, not in a public issue:

- **[Open a private security advisory](https://github.com/0xvikram/backboard-skills/security/advisories/new)**, or
- send a direct message to [@vikram_twt](https://x.com/vikram_twt) on X.

Tell us the skill, the file and line, and what could happen. We aim to reply within 48 hours, and to remove or fix a harmful skill as soon as it's confirmed, before the details are made public.

## What counts

- Instructions that run commands, install software or change files without the user asking
- Anything that sends data, keys or wallet details to a third party
- Links that point somewhere other than the tool's official site, docs or support channels
- Code that sends transactions or approvals the user didn't ask for
- A skill that impersonates a tool or its team

## How we keep skills safe

- Every change goes through a pull request reviewed by the maintainer ([CODEOWNERS](.github/CODEOWNERS)).
- [Automated checks](scripts/validate.mjs) block piped install scripts, private keys, API keys and broken file links on every pull request.
- Generated skills contain no code at all, only links to the tool's official docs and facts from its approved listing.
- Text that tool teams type into the board is flattened to plain words before it reaches a skill.
- A weekly job checks that every link still works.

## Using skills safely

Read a skill before you install it: they're short. Keep real keys in environment variables, never in prompts, and use testnets while you build.
