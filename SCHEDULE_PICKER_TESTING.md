# Schedule Picker Testing Guide

## Preparation

- Dev server running at `http://localhost:3000`
- Navigate to `/teacher/tasks` or relevant teacher page
- Ensure you have at least one class with students in the database

## Test Scenario 1: Basic Schedule Picker Launch

### Steps:

1. Click on task creation button or action to open the modal
2. Fill in required fields:
   - Title: "Test Task" (or any name)
   - Subject: Select any subject from dropdown
   - Type: Keep as "standard"
3. In "Innstillinger" section, locate the "Knytt til time(r)" button

### Expected Results:

- ✓ Button is visible in the modal
- ✓ Button is enabled (not grayed out)
- ✓ Button has white background with indigo text and border

---

## Test Scenario 2: Single Student Context (Primary Path)

### Steps:

1. Select **one student** as recipient
2. Ensure the selected student belongs to a single class
3. Click "Knytt til time(r)" button
4. Wait 1-2 seconds for schedule to load

### Expected Results:

- ✓ Popover opens below/around the button
- ✓ Popover header shows: "Velg timer" with "0 valgt" (or current count)
- ✓ Popover displays days of week (Mandag through Fredag)
- ✓ Only days with lessons are shown (no empty days)
- ✓ Each day shows 2 columns of lesson slots
- ✓ Slots show: time (e.g., "08:30") and subject name below
- ✓ No timestamps or end times are visible

### Lesson Slot Content Verification:

```
Expected:
┌─────────────┐
│ 08:30       │
│ Norsk       │
└─────────────┘

NOT:
┌──────────────────────┐
│ 08:30 - 09:15 Norsk  │
└──────────────────────┘
```

---

## Test Scenario 3: Lesson Type Filtering

### Steps:

1. With schedule popover open, visually scan all visible slots
2. Note the times and subjects displayed

### Expected Results:

- ✓ **Only lessons are shown** (no breaks or lunch periods)
- ✓ If database has "1. time" at 08:30, it shows
- ✓ If database has "pause" at 09:15, it should NOT show
- ✓ If database has "lunch" at 12:00, it should NOT show
- ✓ Slots only appear for `type = 'lesson'` in database

**Verification Query** (run in Supabase):

```sql
SELECT DISTINCT type FROM schedule_entries
WHERE class_id = 'YOUR_CLASS_ID'
ORDER BY type;

-- Should see only: 'lesson' types displayed in popover
```

---

## Test Scenario 4: Subject Color Highlighting

### Steps:

1. Close popover
2. Change the subject dropdown in the modal to a different subject (e.g., from "Norsk" to "Matte")
3. Click "Knytt til time(r)" again to refresh
4. Observe the slot borders/backgrounds

### Expected Results:

- ✓ Slots with subject matching the selected subject have **GREEN border**
- ✓ Slots with different subjects have **SLATE/GRAY border** (default)
- ✓ On hover, matching-subject slots show light green background
- ✓ Non-matching slots show light slate background on hover

### Visual Example:

```
Selected Subject: Norsk

Slot 1 (Norsk) → Green border ✓ (matches)
Slot 2 (Matte) → Gray border (doesn't match)
Slot 3 (Norsk) → Green border ✓ (matches)
```

---

## Test Scenario 5: Multi-Select Functionality

### Steps:

1. With popover open and showing lessons:
2. Click on **Mandag 08:30** (first visible slot)
3. Observe the slot visual change
4. Click on **Tirsdag 09:15** (different day)
5. Click on **Fredag 10:30** (another different day)
6. Count how many slots now have checkmarks

### Expected Results:

- ✓ First click: Slot fills with indigo background, white checkmark appears
- ✓ Popover header count updates: "0 valgt" → "1 valgt" → "2 valgt" → "3 valgt"
- ✓ All 3 selected slots show solid indigo fill with white text
- ✓ All 3 selected slots show white checkmark icon
- ✓ Clicking a selected slot removes it (deselect)
- ✓ Deselected slot returns to default/green state, count decreases

### Deselect Test:

1. Click on an already-selected (indigo) slot
2. Verify it returns to its previous state (gray or green)
3. Verify count decreases by 1

---

## Test Scenario 6: Selected Badges Display

### Steps:

1. With 2-3 lessons selected in popover
2. Click outside the popover or press Escape to close it
3. Observe the area below the "Knytt til time(r)" button

### Expected Results:

- ✓ Compact badges appear showing selected slots
- ✓ Format: "✓ [Day Name] [Start Time]"
- ✓ Example: "✓ Mandag 08:30", "✓ Onsdag 10:15"
- ✓ **NO end times** (should not show "08:30 - 09:15")
- ✓ Badges have indigo background with indigo border
- ✓ Badges have checkmark icon on the left
- ✓ Multiple badges wrap/flex horizontally

### Badge Example:

```
✓ Mandag 08:30    ✓ Onsdag 10:15    ✓ Fredag 13:45
```

---

## Test Scenario 7: Task Creation & Persistence

### Steps:

1. With schedule selected (1-3 lessons picked), select recipients
2. Fill in all required fields:
   - Title: "Integration Test"
   - Subject: "Norsk"
   - Recipients: Single student
3. Click "Opprett oppgave" (or "Opprett" - create button)
4. Wait for success notification
5. Open database viewer or log to verify data

### Expected Results:

- ✓ Modal closes after task creation
- ✓ Success notification appears
- ✓ New row in `tasks` table with correct title, subject, etc.
- ✓ Corresponding rows in `task_schedule_entries` junction table for each selected slot

### Database Verification:

```sql
-- Find the new task
SELECT id, title, subject_id FROM tasks
WHERE title = 'Integration Test'
ORDER BY created_at DESC LIMIT 1;

-- Find linked schedule entries (replace TASK_ID)
SELECT * FROM task_schedule_entries
WHERE task_id = 'TASK_ID';

-- Should have 3 rows if 3 lessons were selected
```

---

## Test Scenario 8: Cross-Class Recipient Validation

### Steps:

1. Select **2 students from DIFFERENT classes** as recipients
2. Observe the "Knytt til time(r)" button
3. Try to click it

### Expected Results:

- ✓ Button becomes **disabled** (grayed out)
- ✓ Button shows cursor-not-allowed on hover
- ✓ Hint text appears below button explaining why:
  - "Velg bare elever fra samme klasse for å knytte til timer"
  - Or similar message indicating same-class requirement
- ✓ Clicking the button has no effect
- ✓ Selected badges do NOT appear

---

## Test Scenario 9: Error Handling

### Test 9a: Empty Schedule

**If the selected student/class has no lessons in database:**

- ✓ Popover opens
- ✓ Message appears: "Ingen timer funnet for denne klassen."
- ✓ No buttons to click
- ✓ No error red alert (this is expected, not an error)

### Test 9b: Database Error Simulation

**Temporarily modify the query in dev tools or database (advanced):**

- ✓ Popover opens
- ✓ Red error box appears with message
- ✓ Loading spinner is gone
- ✓ Message is clear and helpful

### Test 9c: Loading State

**Check loading state before data loads:**

- ✓ After clicking button, before slots appear
- ✓ Message: "Laster timeplan..."
- ✓ No slots shown yet
- ✓ After 2-3 seconds, slots appear and message disappears

---

## Test Scenario 10: Mobile Responsiveness

### Steps (if viewing on mobile or using dev tools mobile view):

1. Open task modal
2. Click "Knytt til time(r)" on mobile viewport
3. Observe popover layout

### Expected Results:

- ✓ Popover adapts to mobile width
- ✓ 2-column slot grid may collapse to 1 column on very small screens
- ✓ Scrollable content is usable
- ✓ Touch interactions (tap) work for slot selection
- ✓ No horizontal scroll needed

---

## Test Scenario 11: Subject-Matched Slots in Detail

### Steps:

1. Open popover with task subject = "Norsk"
2. Identify slots with subject_id matching "Norsk"
3. Identify slots with different subjects
4. Verify visual distinction

### Expected Results:

**Norsk Slot (Matched)**:

```
Border: green-300 (light green)
On hover: bg-green-50 (light green background)
Text: slate-900 (dark)
Clickable: Yes
```

**Non-Norsk Slot (Unmatched)**:

```
Border: slate-200 (light gray)
On hover: bg-slate-100 (light gray background)
Text: slate-700 (darker gray)
Clickable: Yes
```

**Selected Norsk Slot**:

```
Background: indigo-600 (solid indigo)
Border: indigo-700 (darker indigo)
Text: white
Icon: white checkmark
```

**Selected Non-Norsk Slot**:

```
Background: indigo-600 (solid indigo, same as matched)
Border: indigo-700 (same as matched)
Text: white
Icon: white checkmark
```

---

## Test Scenario 12: Scroll and Many Lessons

### Steps:

1. If class has many lessons (10+), open popover
2. Observe days with many slots
3. Scroll within popover
4. Try to select slots at top and bottom

### Expected Results:

- ✓ Popover has max-height (e.g., max-h-96)
- ✓ Vertical scroll bar appears when needed
- ✓ Content scrolls smoothly within popover
- ✓ Modal below popover doesn't scroll
- ✓ Slots at bottom are still selectable
- ✓ No horizontal scroll needed

---

## Test Scenario 13: Re-opening Popover After Selection

### Steps:

1. Select 2 slots and close popover
2. Click "Knytt til time(r)" again to reopen popover

### Expected Results:

- ✓ Popover reopens with previously selected slots still highlighted (indigo)
- ✓ Checkmarks still visible on selected slots
- ✓ Count still shows "2 valgt"
- ✓ Badges still display below button
- ✓ Can add/remove more selections

---

## Test Scenario 14: Form Reset

### Steps:

1. Select 2 lessons
2. Change the subject dropdown to a different subject
3. Observe the schedule picker

### Expected Results:

- ✓ Popover closes automatically
- ✓ Selected badges disappear
- ✓ Selected entry IDs are cleared in state
- ✓ When reopening, all selections are gone
- ✓ Count resets to "0 valgt"
- ✓ This prevents stale selections when subject changes

---

## Test Scenario 15: Keyboard Navigation

### Steps (if using keyboard):

1. Tab to "Knytt til time(r)" button
2. Press Enter/Space to open popover
3. Tab through slot options
4. Press Enter to select a slot
5. Press Escape to close popover

### Expected Results:

- ✓ Button receives focus (visible outline)
- ✓ Enter/Space opens popover (or triggers action)
- ✓ Slots are keyboard-accessible
- ✓ Escape closes popover
- ✓ Focus management is logical (Radix UI Popover handles this)

---

## Common Issues to Check

| Issue                 | Check                                                                          |
| --------------------- | ------------------------------------------------------------------------------ |
| Popover doesn't open  | Check if class has lessons in DB; verify button is enabled                     |
| Slots show timestamps | Verify `selectedBadges` formatter updated to show only start_time              |
| Can't select slots    | Verify `toggleScheduleEntrySelection` function works; check for console errors |
| Badges don't appear   | Close popover; verify state updates; check React DevTools                      |
| Breaks/lunch visible  | Run query: `SELECT type FROM schedule_entries` - verify only 'lesson' in DB    |
| Green borders missing | Check: Does `entry.subject_id === taskForm.subject_id` logic work?             |
| Task not saved        | Check `task_schedule_entries` - may need to verify junction table inserts      |

---

## Console Debugging

Open browser DevTools (F12) and check Console tab for:

- Any `console.error()` messages from fetch operations
- Redux/state management logs (if enabled)
- Network requests to `/schedule_entries` endpoint (should see SELECT query)

---

## Database Schema Verification

Before testing, verify these fields exist in `schedule_entries`:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'schedule_entries';

-- Required: id, class_id, student_id, subject_id,
--           day_of_week, start_time, end_time, type, custom_title
```

Verify `type = 'lesson'` entries exist:

```sql
SELECT COUNT(*) as lesson_count
FROM schedule_entries
WHERE type = 'lesson' AND class_id = 'YOUR_CLASS_ID';
```

---

## Success Criteria Summary

✅ **All tests passing means:**

1. Popover UI renders correctly
2. Lesson filtering works (no breaks/lunch)
3. Multi-select functionality works
4. Subject highlighting works (green border)
5. Selected badges display correctly (no timestamps)
6. Database persistence works (`task_schedule_entries` inserted)
7. Cross-class validation works (button disabled)
8. Error states are friendly
9. Mobile responsive
10. Keyboard accessible

---

## Next Actions After Testing

1. **If all tests pass**: Feature is ready for production
2. **If issues found**: Check console errors and database state
3. **If UI tweaks needed**: Modify Tailwind classes in CreateTaskModal.tsx popover section
4. **If logic issues**: Debug state management in useEffect hooks and event handlers

---

## Quick Reference: Key Files

- **Component**: `src/components/teacher/CreateTaskModal.tsx`
- **Popover UI**: Lines 1225-1315 (schedule UI section)
- **Fetch Logic**: Lines 420-475 (`fetchScheduleForContext`)
- **Selection Toggle**: Lines 475-490 (`toggleScheduleEntrySelection`)
- **Badge Display**: Lines 490-497 (`selectedBadges` formatter)
