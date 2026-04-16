# ADR-013: Timezone-Aware Date Handling

## Status
Accepted

## Date
2026-04-11

## Context

Sales dates are stored as PostgreSQL `DATE` type (calendar date, no time). Initially, all date calculations used UTC, which caused mismatches for users in non-UTC timezones. A user in Melbourne (UTC+11) logging sales at 8am would have their "today" calculated as yesterday in UTC.

## Decision

Store the business's IANA timezone (auto-detected from browser during onboarding) and use it for all date calculations throughout the application.

## Implementation

- `timezone` field on Business model (default: "UTC", validated server-side)
- `src/lib/dates.ts` — centralized date utilities: `getTodayUTC(timezone)`, `getDaysAgoUTC(timezone, n)`, `getDayOfWeekFromDate(date)`, `getLocalDateStr(timezone)`
- All services (analytics, predictions, insights) accept timezone as a parameter
- Frontend sends the user's local date when logging sales
- Weekday extraction parses the YYYY-MM-DD string directly to avoid JS Date timezone ambiguity

## Consequences

- Every date query requires knowing the business timezone (adds a DB lookup or parameter passing)
- Historical data doesn't shift if timezone changes — dates represent the user's local calendar day at time of logging
- `Intl.DateTimeFormat` handles DST transitions automatically
