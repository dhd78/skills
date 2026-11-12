# skills

Agent skills for `CLAUDE.md`-style hosts (Claude Code, Cursor, Codex CLI, Copilot and other `SKILL.md` readers). Each directory is one skill: `SKILL.md` plus its references, examples and a `MANIFEST.md` with per-file SHA-256.

## Skills

| Directory | What it does | Works with |
| --- | --- | --- |
| [`news-daily`](news-daily/) | Produces a ~50-item cross-region, cross-field news digest: one line per item, clickable sources, confidence grading and a self-check table. Triggered on demand — "make today's digest", "what's happening in the world". | Claude Code, Cursor, Codex CLI, DSH, any host that reads `SKILL.md` |
| [`farmer-bridge`](farmer-bridge/) | Drives *The Farmer Was Replaced* through a local BepInEx bridge: read farm/grid/tech state, write and run game code, load a save. Requires the game, BepInEx 5.4.23.6 and the FarmerBridge 0.1.3+ DLL installed by the user. Also on [Agensi](https://www.agensi.io/skills/farmer-bridge) (free). | Claude Code, Cursor, Codex CLI, DSH (Windows only) |

## Install

Copy the skill directory into your host's skills folder:

| Host | Path |
| --- | --- |
| Claude Code | `~/.claude/skills/news-daily/` |
| Cursor | `~/.cursor/skills/news-daily/` |
| Codex CLI | `~/.codex/skills/news-daily/` |
| DSH | the profile's skills directory |

The host must expose a web search tool and a page-fetch tool; `SKILL.md` explains how to rename them for other hosts.

## Layout

```text
skills/
  README.md
  news-daily/
    SKILL.md              trigger + workflow
    README.md             install notes and limits
    MANIFEST.md           per-file SHA-256
    references/
      来源分级.md          source grading rules
      运行手册.md          runbook
      输出模板.md          output template
      验收自检.md          acceptance checklist
    LICENSE               MIT
    AI-DISCLOSURE.md
```

## License

MIT per skill directory. Each skill states its own authorship and AI participation in `AI-DISCLOSURE.md`.
