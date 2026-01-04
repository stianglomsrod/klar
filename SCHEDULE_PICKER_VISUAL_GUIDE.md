# Schedule Picker Visual Guide

## New UI Structure

```
┌─────────────────────────────────────────┐
│  Opprett ny oppgave (Modal)             │
├─────────────────────────────────────────┤
│ [Form fields...]                        │
│                                         │
│ ┌─ Tidsstyring ────────────────────┐   │
│ │ [Hint text]      [Knytt til      │   │ ← Trigger Button
│ │                   time(r)]        │
│ │                                   │   │
│ │ Valgt badges display:             │   │
│ │ [✓ Man 08:30] [✓ Ons 10:15]      │   │
│ │                                   │   │
│ └───────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
                    ▼
        ┌────────────────────────┐
        │  Popover               │
        ├────────────────────────┤
        │ Velg timer         3   │← Count
        │ valgt              ✕   │
        ├────────────────────────┤
        │ MANDAG                 │
        │ ┌─────────────┬─────────┤
        │ │ 08:30  ✓    │ 09:15   │ ← Subject-matched
        │ │ Norsk       │ Matte   │   (green border)
        │ └─────────────┴─────────┤
        │                         │
        │ TIRSDAG                 │
        │ ┌─────────────┬─────────┤
        │ │ 08:30       │ 09:15   │ ← Default
        │ │ Engelsk     │ Matte   │   (slate border)
        │ └─────────────┴─────────┤
        │                         │
        │ ONSDAG                  │
        │ ┌─────────────┬─────────┤
        │ │ 10:15  ✓    │ 10:45   │ ← Selected
        │ │ Norsk       │ Idrett  │   (indigo bg,
        │ └─────────────┴─────────┤    white text)
        │                         │
        │  [Scroll for more days] │
        └────────────────────────┘
```

## Slot States

### 1. Default (Unselected, Subject Doesn't Match)

```
┌─────────────────────┐
│ 08:30               │
│ Engelsk             │ ← Slate border, slate bg
└─────────────────────┘
  hover: bg-slate-100
```

### 2. Subject Match Highlight (Unselected, Subject Matches)

```
┌─────────────────────┐
│ 08:30               │
│ Norsk               │ ← Green border, light green on hover
└─────────────────────┘
  hover: bg-green-50
```

### 3. Selected State

```
┌─────────────────────┐
│ 08:30           ✓   │
│ Norsk               │ ← Indigo bg, white text, solid fill
└─────────────────────┘
  No hover (already selected)
```

## Key Features

### ✓ Filtering

- Only shows `type = 'lesson'` slots
- Breaks and lunch periods hidden automatically
- Cleaner, more focused interface

### ✓ Flexible Assignment

- Teachers can select ANY lesson slot
- Subject matching is now visual feedback, not a blocker
- Green border highlights matching subjects
- No subject-based slot disabling

### ✓ Compact Display

- Timestamps removed (show only start time)
- Subject titles optional, shown below time
- 2-column grid layout
- Scrollable if many lessons

### ✓ Multi-Select

- Click any slot to toggle selection
- Checkmark appears when selected
- Count updates in popover header
- Multiple slots across different days allowed

### ✓ Visual Feedback

- Subject color correlation via green border
- Strong indigo fill for selected slots
- Clear distinction between states
- Checkmark icon for selected slots

## Display Examples

### Badge Display (After Popover Closes)

```
Valgt: 3 timer
┌──────────────┬──────────────┬──────────────┐
│ ✓ Man 08:30  │ ✓ Ons 10:15  │ ✓ Fre 13:45  │
└──────────────┴──────────────┴──────────────┘
```

### Mini Slot Display (in 2-column grid)

```
Slot: 08:30          Slot: 09:15
Subject: Norsk       Subject: Matte
[Compact]            [Compact]
```

## Mobile Responsiveness

```
Desktop (w-96):               Mobile (default width):
Two columns per day           One column per day
Full subject titles           Abbreviated if needed
```

## Error & Loading States

### Loading

```
┌────────────────────┐
│ Velg timer    ···  │
│                    │
│  Laster timeplan   │
│                    │
└────────────────────┘
```

### Error

```
┌────────────────────┐
│ Velg timer     ✕   │
│ ┌────────────────┐ │
│ │ Kunne ikke     │ │
│ │ laste timeplan │ │
│ └────────────────┘ │
└────────────────────┘
```

### No Lessons Available

```
┌────────────────────┐
│ Velg timer     ✕   │
│                    │
│ Ingen timer funnet │
│ for denne klassen.  │
│                    │
└────────────────────┘
```

## Interaction Flow

1. **Open Modal** → User creates new task form
2. **Click "Knytt til time(r)"** → Popover opens, fetches schedule
3. **View Lessons** → Days organized vertically, lessons in 2-column grid
4. **Select Slots** → Click to toggle; subject-matched slots show green border
5. **Close Popover** → Selected slots appear as badges below button
6. **Save Task** → Task linked to selected slots via `task_schedule_entries` junction table

## Key Differences from Previous Version

| Feature             | Before                        | After                        |
| ------------------- | ----------------------------- | ---------------------------- |
| Container           | Inline expandable             | Popover dialog               |
| Lesson Filtering    | N/A                           | type = 'lesson' only         |
| Subject Restriction | Hard blocker (slots disabled) | Soft feedback (green border) |
| Timestamps          | Full display (08:30 - 09:15)  | Minimal (08:30 only)         |
| Grid Layout         | 3 columns                     | 2 columns (more compact)     |
| Visual Clarity      | Good                          | Excellent (focused, minimal) |
| Mobile Space        | Takes up room in modal        | Pops over, keeps modal clean |

## Performance Considerations

- **Lazy Fetch**: Schedule only fetches when button clicked
- **Scrollable Popover**: Max-height with overflow maintains performance
- **Set-based Selection**: O(1) toggle/lookup for selections
- **Filtered Query**: Database returns only lessons (not breaks/lunch)

## Accessibility Features

- Semantic button with proper disabled states
- Popover trigger clearly labeled
- Count badge for quick feedback
- Checkmark icon for visual confirmation
- Keyboard support via Radix UI Popover
- Error messages in appropriate color (red)
- Loading state clearly indicated
