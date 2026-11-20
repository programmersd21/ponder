# Security Policy

## Supported Versions

This project is actively maintained on the default branch. Security fixes are applied to the latest version.

## Reporting a Vulnerability

If you discover a security vulnerability, please report it privately:

- **Preferred:** Open a [private security advisory](https://github.com/programmersd21/ponder/security/advisories/new) for this repository.
- **Alternative:** Contact the maintainer via GitHub [@programmersd21](https://github.com/programmersd21).

Please do not open a public issue for security-sensitive reports.

When reporting, include:
- A description of the issue and its potential impact
- Steps to reproduce or a proof of concept
- Affected components (e.g. server routes, credential handling, client)

## Security Notes

- **API keys:** Gemini and Serper keys are user-provided. They are validated server-side and stored encrypted; never commit keys to the repository or share them in issues.
- **Encryption key:** Set `PONDER_ENCRYPTION_KEY` to a stable secret in production so stored credentials can be decrypted across restarts/instances. If unset, an ephemeral key is used and credentials do not persist.
- **Secrets in config:** Keep `.env` files local (they are gitignored). Use `.env.example` as a template with placeholders only.
- **Deployment:** When deploying (e.g. Vercel), configure secrets via environment variables, not in source control.

## Disclosure

After a fix is available, we may publish an advisory describing the issue and mitigation. Please allow reasonable time for investigation and remediation before public disclosure.
