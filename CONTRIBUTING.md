# Contributing to BuddyPay

Thanks for your interest! Issues and pull requests are welcome. (ภาษาไทยก็ได้ครับ)

## Setup

Follow [Run it yourself](README.md#run-it-yourself). Node 22 is recommended (`nvm use`).

## Before opening a pull request

```bash
npm run typecheck
npm run lint
npm test
```

- If you change `firestore.rules`, add a test in `tests/rules/` (`npm run test:rules`, needs Java 21).
- If you change the bill flow UI, run the E2E test: `npm run build && npx next start -p 3100`, then `npm run test:e2e` in another terminal.
- Money must stay in integer satang — use `app/lib/money.ts`, never add floats directly.
- Keep amounts computed by `calculateSplit` (`app/lib/billCalculator.ts`) so every screen shows the same numbers.

## Rules

- Never commit `.env.local`, API keys, service accounts or any other secret.
- One topic per pull request, with a short description of what changed and how you tested it.
- CI (typecheck, lint, unit, rules, E2E, build) must pass before merge.
