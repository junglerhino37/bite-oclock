# Security Policy

Bite o'Clock is a public, crowdsourced project. User-submitted content (photos,
deal data) is untrusted input everywhere in the pipeline. These rules are
non-negotiable for all contributions:

## Ground rules
1. **No secrets in the repo.** API keys, database URLs, and service credentials
   live in environment variables only. `.env.example` documents the names;
   `.env*` is gitignored. If you accidentally commit a secret, rotate it —
   removing the commit is not enough.
2. **All AI calls are server-side.** The Claude API key never reaches the
   browser. Client code talks only to our own API routes.
3. **Uploads are hostile until proven otherwise.** Enforce content-type and
   size limits, re-encode images server-side (which also strips EXIF/GPS
   metadata), and never serve user uploads from the app origin with executable
   content types.
4. **AI output is data, not instructions.** Text extracted from menu photos is
   schema-validated before it touches the database and is never interpolated
   into prompts as instructions. Menu photos are a prompt-injection vector —
   treat extraction results accordingly.
5. **Everything crowdsourced goes through moderation** before it is publicly
   visible. No direct-to-published writes from anonymous users.
6. **Rate-limit every write and every AI endpoint.** AI endpoints also have
   hard cost caps.
7. **Least privilege in the database.** Public reads via row-level security /
   scoped views; writes only through server routes.

## Reporting a vulnerability
Please **do not open a public issue** for security problems. Use GitHub's
private vulnerability reporting ("Security" tab → "Report a vulnerability")
on this repository. We'll respond as fast as a volunteer project can —
typically within a few days.
