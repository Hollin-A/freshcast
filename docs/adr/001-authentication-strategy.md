# ADR-001: Authentication Strategy

## Status
Accepted

## Date
2026-03-29

## Context

Freshcast targets small retail business owners with moderate digital literacy. We need an authentication approach that is:

- Familiar and low-friction for non-technical users
- Simple to implement for MVP
- Secure enough for business data
- Scoped to one account per business (no multi-user in MVP)

Options considered:

1. **Email/password only** — universally understood, but password fatigue is real
2. **Email/password + magic link** — familiar baseline with a passwordless option for convenience
3. **Social login (Google/Apple)** — convenient but adds OAuth complexity and may not suit all markets
4. **Phone/OTP** — great for mobile-first, but requires SMS provider integration and cost per message
5. **Social + email + OTP (full suite)** — maximum flexibility but significant MVP complexity

## Decision

Email/password with optional magic link (passwordless) for MVP.

## Rationale

- Email/password is the most universally understood auth method across all digital literacy levels
- Magic link adds a passwordless option without significant implementation overhead
- Social login and OTP are deferred — they add integration complexity (OAuth providers, SMS services) without proportional MVP value
- One account = one business keeps the auth model simple (no roles, no permissions)
- Magic link also serves as the password reset mechanism, reducing separate flows

## Consequences

- Users must have an email address (reasonable assumption for business owners)
- No phone-only authentication path in MVP (some markets may prefer this)
- Social login can be added in future phases without breaking changes
- Session persistence (stay logged in) is important to reduce re-authentication friction

## Future Considerations

- Phase 5+: Add social login (Google, Apple), phone/OTP, and MFA
- Multi-user support per business will require role-based access control
