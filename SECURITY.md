# Security policy

## Current status

MUTANT does not yet contain an executable application. The authentication document is a proposed baseline, not deployed behavior. This policy will be revised when code and supported releases exist.

## Reporting a vulnerability

Please **do not open a public issue** containing exploit details, credentials, personal data, or an unpatched vulnerability.

Use GitHub's private vulnerability-reporting interface if it is available under the repository's **Security** tab. If it is not available, contact the maintainer through the [SOMINSART GitHub profile](https://github.com/SOMINSART) and ask for a private reporting channel without including sensitive details in the first public message.

Include, when safe:

- affected commit, tag, file, or component;
- impact and realistic attack scenario;
- minimal reproduction steps;
- required privileges or preconditions;
- suggested remediation, if known;
- whether the issue has been disclosed elsewhere.

## Response principles

The maintainer should acknowledge a complete report, reproduce it privately, coordinate a fix and disclosure timeline, rotate any exposed credentials, and credit the reporter unless anonymity is requested. Exact response times are not promised until a maintained release and response capacity exist.

## Supported versions

No supported software version has been released yet. Once releases exist, this section will list supported versions and end-of-support dates.

## Secrets

- Never commit passwords, API keys, private keys, access tokens, session tokens, or real `.env` files.
- Use placeholders in examples.
- Treat a committed secret as compromised even if the commit is later deleted.
- Revoke and rotate first; history rewriting alone is not remediation.

## Safe research

Good-faith research should avoid privacy violations, service disruption, data destruction, social engineering, and access beyond the minimum needed to demonstrate the issue.