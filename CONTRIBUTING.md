# Contributing

## Tool teams: improve your skill

Your tool's skill lives at `skills/<your-tool>/SKILL.md`. To make it better:

1. Open a pull request that edits the file. Good additions: the install command with the current version, the 3 to 5 calls a hacker needs first, testnet and faucet details, and the errors people hit most.
2. Delete the line `<!-- backboard:generated -->` in your version. That marks the skill as hand-written, so the board never overwrites it again.
3. Keep the `name` in the front matter the same as the folder name.

We review every pull request before merging. A skill is instructions an AI assistant follows on a hacker's machine, so we won't merge anything that runs commands without asking, sends data anywhere, or asks for keys.

Larger references (code samples, longer guides) can go in `skills/<your-tool>/references/` and be linked from `SKILL.md`.

## Everyone else

Found a broken link or a wrong fact? Open an issue or a pull request.

## Removing a skill

If you're on a tool's team and want its skill taken down, open an issue or message [@vikram_twt](https://x.com/vikram_twt).
