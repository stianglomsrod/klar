# Folder Restructuring Checklist

## Files Already Created ✅

- ✅ `src/app/(dashboard)/layout.tsx` - Dashboard wrapper with sidebar
- ✅ `src/app/(auth)/layout.tsx` - Auth wrapper (clean)
- ✅ `src/app/(auth)/login/page.tsx` - Login moved to auth group
- ✅ `src/app/layout.tsx` - Updated to be minimal

## Next Steps - Folder Moves (Do in VS Code)

### Manual Step 1: Move teacher folder
```
MOVE: src/app/teacher/ → src/app/(dashboard)/teacher/
```

### Manual Step 2: Move student folder (if exists)
```
MOVE: src/app/student/ → src/app/(dashboard)/student/
```

### Manual Step 3: Delete old login folder
```
DELETE: src/app/login/ (we've moved this to (auth))
```

## Verification Checklist ✓

After moving the folders, verify:

- [ ] `/login` loads clean (no sidebar/footer)
- [ ] Login redirects to `/teacher` or `/student`
- [ ] `/teacher` loads with sidebar and mobile menu
- [ ] `/student` loads with proper layout
- [ ] Mobile menu opens/closes smoothly
- [ ] Desktop sidebar appears on lg screens

## How Route Groups Work

- `(auth)` folder → URLs like `/login` (not `/auth/login`)
- `(dashboard)` folder → URLs like `/teacher` (not `/dashboard/teacher`)
- Route groups organize code structure without affecting URLs

## Updated URLs After Refactoring

| Page | URL | Layout |
|------|-----|--------|
| Login | `/login` | Root + (auth) → clean ✓ |
| Teacher Dashboard | `/teacher` | Root + (dashboard) + sidebar ✓ |
| Student Dashboard | `/student` | Root + (dashboard) + layout ✓ |

---

**That's it! Once you move the folders, the refactoring is complete.** No code changes needed.
