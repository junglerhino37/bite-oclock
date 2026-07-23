# Contributing to Bite o'Clock

Thanks for helping Houston eat better, cheaper. Contributions of all kinds are
welcome: code, design, data (happy hour menus!), and moderation.

## Ways to contribute
- **Add/fix happy hour data** — the whole point of the site. Use the upload flow
  on the site itself, or open a PR against the seed data with a source photo.
- **Code** — pick an open issue, comment that you're taking it, PR when ready.
- **Design** — see the design tokens and UI principles in [AGENTS.md](AGENTS.md).

## Dev setup
1. Fork + clone, then `npm install`.
2. Copy `.env.example` → `.env.local` and fill in your own keys (see README).
   You never need production credentials to develop — every service we use has
   a free tier you can self-provision.
3. `npm run dev` and open the printed URL.

## Pull requests
- Keep PRs focused; small is fast to review.
- Run `npm run lint` and `npm run build` before pushing.
- UI changes: include a screenshot (mobile width too — most traffic is phones).
- Anything touching uploads, AI endpoints, or the database must follow
  [SECURITY.md](SECURITY.md). PRs that add secrets, client-side API keys, or
  unmoderated write paths will be declined.

## Data quality
- Houston only. Deals must be verifiable (photo of the menu is the gold standard).
- Don't scrape sources whose terms forbid it.

## Conduct
Be kind. Restaurant staff are people; competitors' apps are not our enemies;
new contributors get patience. Maintainers may remove content or contributors
that make the project worse to be around.
