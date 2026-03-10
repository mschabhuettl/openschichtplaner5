# Contributing to OpenSchichtplaner5

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>
```

### Types

| Type | When to use |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `test` | Adding or updating tests |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | Performance improvement |
| `chore` | Build, CI, dependency updates, version bumps |
| `security` | Security fix or hardening |

### Scope (optional)

Use a module or component name — **never internal task IDs**:

✅ `feat(schedule): add monthly calendar view`  
✅ `fix(auth): correct token expiry timer`  
✅ `security(api): add rate limiting middleware`  
❌ `feat(Q035): Kalender-Ansicht` ← no internal IDs  
❌ `Q028: Backend input-sanitization` ← missing type  

### Examples

```
feat(schedule): add monthly calendar view with shift chips
feat(auth): implement TOTP two-factor authentication
feat(employees): extend profile with skills, availability and contract hours
fix(schedule): correct overnight shift overlap detection
fix(auth): use x-auth-token header instead of Authorization Bearer
security(api): activate rate limiting — login 5/min, global 100/min
security(auth): migrate passwords from MD5 to bcrypt with auto-migration
docs(api): complete OpenAPI descriptions for all 236 endpoints
test(auth): add full 2FA lifecycle coverage — 53 new tests
chore(release): bump version to 1.0.0-rc4
refactor(db): introduce SQLAlchemy ORM abstraction layer
perf(api): add TTL-based in-memory cache for frequent endpoints
```

## Versioning

See `memory/sp5-versioning-policy.md` for the full versioning policy.

**Short version:** After every stabilization batch, bump all three version locations:
1. `frontend/package.json`
2. `backend/api/main.py` (`_API_VERSION` + FastAPI `version=`)
3. Git tag: `git tag -a vX.Y.Z -m "vX.Y.Z — short description"`
