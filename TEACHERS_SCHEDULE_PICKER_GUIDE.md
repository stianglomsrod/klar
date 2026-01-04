# Teacher's Guide: Schedule Picker Feature

## Quick Start

### Creating a Task with Schedule Linking

1. **Open Task Creation**

   - Navigate to teacher dashboard
   - Click "Opprett ny oppgave" or similar button

2. **Fill in Task Details**

   - Title: What students will see
   - Description: Task instructions
   - Subject: Which subject (e.g., Norsk, Matte)
   - Type: Standard task or Quiz
   - Due Date: When the task is due

3. **Select Recipients**

   - Choose class(es) and/or individual student(s)
   - **Tip**: For best results, keep students from the same class

4. **Link to Schedule (NEW!)**

   - Look for **"Knytt til time(r)"** button in the Innstillinger section
   - Click to open the schedule picker
   - A popover window will appear showing the week's lessons

5. **Select Lesson Slots**

   - Click on any lesson slot you want to link this task to
   - Selected slots will turn **indigo** with a **checkmark**
   - You can select multiple slots across different days
   - ✓ Hints: Green-bordered slots match your task's subject!

6. **Review Your Selections**

   - Close the popover (click elsewhere or press Escape)
   - Your selected slots appear as badges below the button
   - Format: "✓ Mandag 08:30", "✓ Onsdag 10:15", etc.

7. **Create the Task**
   - Click **"Opprett oppgave"** button
   - Task is created and linked to all selected slots!

---

## Understanding the Schedule Picker

### When You Click "Knytt til time(r)"

A popover window opens showing:

```
┌─────────────────────────────┐
│ Velg timer          3 valgt │  ← Selection count
├─────────────────────────────┤
│ MANDAG                      │
│ ┌──────────────┬──────────────┤
│ │ 08:30    ✓   │ 09:15        │
│ │ Norsk        │ Matte        │
│ └──────────────┴──────────────┤
│                              │
│ TIRSDAG                      │
│ ┌──────────────┬──────────────┤
│ │ 10:15   ✓    │ 11:00        │
│ │ Norsk        │ Engelsk      │
│ └──────────────┴──────────────┤
│                              │
│ [Scroll for more days]       │
└─────────────────────────────┘
```

### Color Meanings

| Color                       | Meaning              | Action                           |
| --------------------------- | -------------------- | -------------------------------- |
| **Slate/Gray Border**       | Regular lesson       | Click to select                  |
| **Green Border**            | Matches task subject | Still clickable; subject-aligned |
| **Indigo Fill + Checkmark** | Selected             | Click to deselect                |

### What You See

- **Time**: Start time of the lesson (e.g., "08:30")
- **Subject**: What subject the slot is for (e.g., "Norsk")
- **Days**: Organized by Monday through Friday
- **Only Lessons**: No breaks or lunch periods (just lessons!)

---

## Pro Tips

### 💡 Subject Alignment

When your task is for a specific subject:

- **Green borders** highlight slots for that subject
- This helps you see which lessons are best matched
- But you can still click any lesson if needed!

### 💡 Multi-Select Power

- Click multiple slots across the full week
- Good for: Tasks given in multiple classes' lessons
- Example: Give the same Norsk task in all three Norsk lessons

### 💡 Individual Students

- If you select one student, you'll see THEIR schedule
- If they have custom schedule overrides, they show up here
- Perfect for targeting specific student groups

### 💡 Same Class Requirement

- All selected recipients must be from the **same class**
- If mixing classes, the "Knytt til time(r)" button disables
- Solution: Create separate tasks for each class, or use class-level recipients

---

## Troubleshooting

### "Knytt til time(r)" Button is Grayed Out

**Why**: You selected students from different classes
**Fix**: Pick only students from the same class

### Popover is Empty ("Ingen timer funnet")

**Why**: The class has no lessons in the database
**Fix**: Contact system admin to add lessons to the schedule

### I Can't See Breaks or Lunch

**Why**: By design! Only lessons show here (less clutter)
**Fix**: This is expected. All slots shown are lessons.

### Green Borders Not Showing

**Why**: Slots don't match your task's subject
**Fix**: Select a subject in the main form first, then open picker

### Can't Close Popover

**How to close**:

- Click outside the popover
- Press Escape key
- Click the button again

---

## Workflow Examples

### Example 1: Single Lesson Task

Scenario: "Spelling test in Norsk on Wednesday"

1. Select one class
2. Subject: Norsk
3. Click "Knytt til time(r)"
4. Select just **Onsdag 10:15** (Wednesday at 10:15)
5. Create task

**Result**: Task appears specifically in that one lesson slot

---

### Example 2: Weekly Homework

Scenario: "Norsk homework given in all Norsk lessons"

1. Select all Norsk teachers' students (same class)
2. Subject: Norsk
3. Click "Knytt til time(r)"
4. Select **all Norsk lesson slots** (e.g., Mon 08:30, Wed 10:15, Fri 13:45)
5. Create task

**Result**: Homework linked to all Norsk lessons for the week

---

### Example 3: Cross-Subject Project

Scenario: "Science project relevant to multiple subjects"

1. Select the class
2. Subject: (your primary subject)
3. Click "Knytt til time(r)"
4. Select relevant lessons across subjects (e.g., Science, Math, English)
5. Create task

**Result**: Task linked to multiple different subject lessons

---

## Badges: Reading Your Selections

After selecting slots, you see badges like:

```
✓ Mandag 08:30    ✓ Onsdag 10:15    ✓ Fredag 13:45
```

Each badge shows:

- ✓ Checkmark (already selected)
- Day name (e.g., "Mandag")
- Time (e.g., "08:30") - just the start time, not end time

---

## Advanced: Understanding the Grid

The picker shows a **2-column grid** per day:

```
MANDAG              (Two lessons per row)
┌──────────┬──────────┐
│ 08:30    │ 09:15    │
│ Norsk    │ Matte    │
└──────────┴──────────┘

TIRSDAG
┌──────────┬──────────┐
│ 08:30    │ 10:15    │
│ Engelsk  │ Norsk    │
└──────────┴──────────┘
```

This compact layout saves space and keeps focus. You can scroll to see more days or select from the visible slots.

---

## FAQ

**Q: Can I link multiple different subjects in one task?**
A: Yes! You can link any lesson slots to any task. The green highlighting is just visual feedback.

**Q: What happens if I change the subject after selecting slots?**
A: Your selections clear automatically. This prevents mismatches. You'll need to re-select slots.

**Q: Will students see which lessons the task is linked to?**
A: The backend supports this, but the student view isn't implemented yet. Currently, they just see the task.

**Q: Can I edit a task's schedule links after creation?**
A: Not yet. Delete the task and create a new one with updated schedule links.

**Q: Why does it say "Same class required"?**
A: Each class has its own schedule. Mixing classes would cause conflicts. Keep recipients from one class.

**Q: What's the difference between the task subject and the slot subjects?**
A: Task subject is what you teach (your subject). Slot subjects show what each time slot is for. Mismatches are OK but the green border helps you align them if desired.

---

## Keyboard Shortcuts

- **Tab**: Navigate between buttons and slots
- **Enter/Space**: Select/deselect a slot
- **Escape**: Close the popover
- **Arrow Keys**: (if supported) Navigate grid

---

## Feedback & Support

If you encounter issues:

1. **Check Console**: Open browser DevTools (F12) - look for red errors
2. **Try Refresh**: Hard refresh the page (Ctrl+Shift+R)
3. **Contact Admin**: Report specific errors or unexpected behavior
4. **Test Steps**: Use the detailed testing guide if creating bug reports

---

## Summary

**The Schedule Picker lets you:**

- ✅ Link tasks to specific lesson times
- ✅ Select multiple lessons across the week
- ✅ See subject-matched slots highlighted
- ✅ Keep the interface clean and focused
- ✅ Maintain full flexibility in scheduling

**Key Remember**:

- 🔑 Select from same class
- 🔑 Only lessons show (no breaks/lunch)
- 🔑 Green = subject match, but not required
- 🔑 Indigo + checkmark = selected
- 🔑 Badges show your final selections

**Happy task creating!** 🎉
