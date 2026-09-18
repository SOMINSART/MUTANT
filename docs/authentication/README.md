# MUTANT authentication

> **Status:** architecture note — not an implementation claim  
> **Audit date:** 2026-09-18  
> **Repository:** https://github.com/SOMINSART/MUTANT

## 1. Current state

At the time of this audit, MUTANT contained no application source, dependency manifest, deployment configuration, or authentication documentation. Consequently, MUTANT currently has:

| Component | Current state |
|---|---|
| Signup / login / logout | Not implemented |
| User or identity store | Not implemented |
| Password hashing | Not implemented |
| Session or access-token issuance | Not implemented |
| Token verification, rotation, or revocation | Not implemented |
| Password reset / email verification | Not implemented |
| OAuth / OpenID Connect | Not implemented |
| Application secrets | None committed |

There is therefore **no MUTANT application-authentication request flow yet**, and no user credentials or application tokens are currently handled by this repository.

### GitHub access is separate

The repository itself is public: reading or cloning it does not require a MUTANT account. GitHub—not MUTANT—authenticates users who create commits, issues, or other repository changes and applies their GitHub permissions. Those GitHub credentials and tokens are not stored in this repository.

## 2. Proposed baseline architecture

The following is a recommended starting point for a browser-based application. It must remain labelled as proposed until matching code and tests are committed.

### Components

1. **Client:** browser UI; never stores passwords or long-lived bearer tokens.
2. **TLS edge / reverse proxy:** terminates HTTPS and forwards requests to the API.
3. **Auth/API service:** validates input, hashes passwords, creates and verifies sessions, enforces authorization.
4. **User database:** stores normalized identities, password hashes, roles, verification state, and audit timestamps.
5. **Session store:** stores only hashed opaque session or refresh tokens, expiry, rotation state, and revocation state.
6. **Email service:** delivers verification and password-reset links without logging their full tokens.
7. **Secret manager:** injects signing keys, email credentials, and provider API keys at runtime.
8. **Optional OIDC provider:** handles third-party sign-in through Authorization Code + PKCE.

```text
Browser --HTTPS--> Edge proxy --> Auth/API service --> User + session database
                                  |
                                  +--> Email service
                                  +--> Secret manager
                                  +--> Optional OIDC provider
```

## 3. Proposed request flows

### Registration

1. Client sends email and password over HTTPS to `POST /auth/signup`.
2. Server normalizes the email, validates input, and checks uniqueness.
3. Server hashes the password with Argon2id (preferred) or a deliberately configured bcrypt work factor.
4. Server stores only the hash and account metadata.
5. Server creates a short-lived, single-use email-verification token; only its hash is stored.
6. After verification, the server creates a session and returns an opaque identifier in a `Secure`, `HttpOnly`, `SameSite=Lax` cookie.

### Login and protected request

```mermaid
sequenceDiagram
    participant U as User
    participant B as Browser
    participant A as Auth/API
    participant D as User + session DB
    U->>B: Email and password
    B->>A: POST /auth/login over HTTPS
    A->>D: Load user and password hash
    A->>A: Constant-time password verification
    A->>D: Store hash of random session token
    A-->>B: Set-Cookie: session=...; Secure; HttpOnly; SameSite=Lax
    B->>A: Protected request + session cookie
    A->>D: Validate session, expiry, revocation, and user state
    A-->>B: Authorized response
```

Login errors should be generic, rate-limited, and auditable without recording the submitted password or raw token.

### Logout

1. Client calls `POST /auth/logout` with the session cookie.
2. Server revokes the matching session record.
3. Server clears the cookie.
4. Logging out must invalidate the server-side session; deleting client state alone is insufficient.

### Password reset

1. Client submits an email address.
2. Server always returns the same response, whether the address exists or not.
3. For an existing account, the server generates at least 256 random bits.
4. Only the token hash is stored, with a short expiry (for example 30 minutes) and single-use state.
5. The raw token is sent only in an HTTPS email link and is never written to application logs.
6. After successful reset, all existing sessions for the account are revoked.

## 4. Credential and token rules

| Item | Where it may exist | Required handling |
|---|---|---|
| Plaintext password | Client input and server memory during verification only | HTTPS; never persist or log; discard immediately |
| Password hash | User database | Argon2id or configured bcrypt; unique salt; rehash on policy upgrade |
| Browser session token | `Secure`, `HttpOnly`, `SameSite` cookie | High entropy; short idle/absolute expiry; server-side revocation |
| Stored session value | Session database | Store a cryptographic hash, not the raw token |
| Password-reset / verification token | HTTPS link; token hash in database | Random, short-lived, single-use; redact from logs and analytics |
| Optional access JWT | Process memory; sent as bearer only where required | 10–15 minute lifetime; validate `iss`, `aud`, `exp`, signature, and `jti` |
| Optional refresh token | `Secure`, `HttpOnly` cookie; hash in database | Rotate on every use; detect reuse; revoke token family on reuse |
| OAuth/OIDC client secret | Secret manager and backend runtime only | Authorization Code + PKCE; never expose to the frontend |
| Service API keys | Secret manager and backend runtime only | Least privilege; rotation; never commit, return to clients, or log |

### Browser storage

Do not place long-lived access or refresh tokens in `localStorage` or `sessionStorage`; an injected script can read them. Prefer an `HttpOnly` cookie and add CSRF protection to state-changing requests. If a native or third-party API requires bearer tokens, use short-lived access tokens and a rotated refresh-token design.

### Secret configuration

- Commit only a `.env.example` containing empty placeholders.
- Ignore real `.env` files and generated credentials.
- Fail startup if a required production secret is missing; never ship a known fallback secret.
- Separate development, staging, and production keys.
- Rotate credentials after suspected exposure and document the rotation procedure.

## 5. Authorization after authentication

Authentication establishes identity; it does not grant unlimited access. Every protected handler must:

- derive the user identity from the verified session—not from a client-supplied user ID;
- check ownership, role, scope, and tenant boundaries on the server;
- deny by default;
- return minimal data;
- record security-relevant events without secrets.

## 6. Minimum controls before a public release

- Rate limits for signup, login, verification, and reset endpoints.
- CSRF protection when cookies authenticate requests.
- Strict CORS allowlist where cross-origin access is required.
- Secure response headers and TLS-only production traffic.
- Email verification and optional MFA/passkeys for sensitive actions.
- Session inventory and “log out all devices.”
- Dependency, secret, and static security scanning in CI.
- Automated tests for expiry, revocation, replay, privilege boundaries, and account enumeration.
- Recovery procedure for signing-key or provider-key compromise.

## 7. Documentation contract

When authentication code is added, this document should be updated in the same pull request with:

- exact source-file and route links;
- a list of public and protected endpoints;
- the real session/token lifetimes;
- storage locations and encryption/hashing choices;
- logout, reset, rotation, and revocation behavior;
- known limitations and security tests.

Until that happens, the only accurate statement is: **MUTANT does not yet implement application authentication or handle application credentials/tokens.**