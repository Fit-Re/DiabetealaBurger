# DiabetealaBurger — Claude Code Instructions

## Project Context

**DiabetealaBurger** is a diabetes management platform being polished from prototype to production (0→100).

### What is it?
- A diabetes health app that synthesizes evidence, provides personalized insights, and tracks lifestyle factors.
- Built with modern web stack (TBD pending review).
- Target users: people with diabetes seeking better self-management and evidence-based guidance.

### Current Status
- **Phase 1** (Discovery & Planning) — Ready to start
- **Design** on pause pending CEO decisions on scope/vision
- **Tech debt** identified (Gemini rate limiting fixed as of Aug 9)

---

## G Stack Skills

This project uses G Stack for planning and review. Key skills:

- `/plan-ceo-review` — Strategy, scope decisions, CEO-level vision
- `/plan-eng-review` — Architecture validation, tech decisions
- `/plan-design-review` — UX/UI review and polish
- `/spec` — Backlog and requirements docs
- `/investigate` — Bug hunting and tech debt
- `/qa` — QA testing and verification
- `/ship` — Pre-ship checklist and deployment

Run `/learn` first to understand the codebase.

---

## Skill Routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Bugs/errors → invoke /investigate
- QA/testing → invoke /qa or /qa-only
- Code review → invoke /review
- Ship/deploy → invoke /ship or /land-and-deploy

---

## Engineering Preferences

- **Completeness over shortcuts** — Boil the ocean. AI makes full coverage cheap.
- **Tests first** — New code without tests doesn't ship.
- **DRY is important** — Flag repetition.
- **Explicit over clever** — Right-sized diff that cleanly expresses change.
- **Observability mandatory** — New code paths need logs, metrics, or traces.

---

## Team

- **Owner**: @randgal99 (Randall Galloway)
- **AI Pair**: Claude Code (Haiku 4.5)

