# Klar Project File Tree

```
klar/
├── .env.local
├── .gitignore
├── DOCUMENTATION_INDEX.md
├── eslint.config.mjs
├── FILE_TREE.md
├── FINAL_VERIFICATION_REPORT.md
├── next-env.d.ts
├── next.config.ts
├── package-lock.json
├── package.json
├── postcss.config.mjs
├── README.md
├── README_SCHEDULE_PICKER.md
├── REFACTORING_STEPS.md
├── SCHEDULE_PICKER_IMPLEMENTATION_CHECKLIST.md
├── SCHEDULE_PICKER_REFACTOR.md
├── SCHEDULE_PICKER_SUMMARY.md
├── SCHEDULE_PICKER_TESTING.md
├── SCHEDULE_PICKER_VISUAL_GUIDE.md
├── SETUP_CHECKLIST.md
├── TEACHERS_SCHEDULE_PICKER_GUIDE.md
├── tailwind.config.ts
├── tsconfig.json
│
├── klar/                                  (empty)
│
├── public/
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   ├── window.svg
│   └── sounds/
│       └── pling.mp3
│
├── src/
│   ├── app/
│   │   ├── favicon.ico
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   │
│   │   ├── (auth)/
│   │   │   ├── layout.tsx
│   │   │   └── login/
│   │   │       └── page.tsx
│   │   │
│   │   ├── (dashboard)/
│   │   │   ├── student/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx
│   │   │   │   ├── fag/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── lesson/
│   │   │   │       └── [id]/
│   │   │   │           └── page.tsx
│   │   │   │
│   │   │   └── teacher/
│   │   │       ├── layout.tsx
│   │   │       ├── page.tsx
│   │   │       ├── classes/
│   │   │       │   └── page.tsx
│   │   │       ├── messages/
│   │   │       │   ├── page.tsx
│   │   │       │   ├── lib/               (empty)
│   │   │       │   └── _components/
│   │   │       │       └── RecipientSelector.tsx
│   │   │       ├── rewards/
│   │   │       │   └── page.tsx
│   │   │       ├── students/
│   │   │       │   └── [id]/
│   │   │       │       └── page.tsx
│   │   │       ├── tasks/
│   │   │       │   └── page.tsx
│   │   │       └── timeplan/
│   │   │           └── page.tsx
│   │   │
│   │   ├── api/
│   │   │   └── seed/
│   │   │       └── route.ts
│   │   │
│   │   ├── belonninger/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── hage/
│   │   │   │   └── page.tsx
│   │   │   └── kuponger/
│   │   │       └── page.tsx
│   │   │
│   │   └── subject/
│   │       ├── layout.tsx
│   │       └── [id]/
│   │           └── page.tsx
│   │
│   ├── components/
│   │   ├── ArchiveDrawer.tsx
│   │   ├── CompletionModal.tsx
│   │   ├── ConditionalLayout.tsx
│   │   ├── FlowerPot.tsx
│   │   ├── LevelUpModal.tsx
│   │   ├── Navigation.tsx
│   │   ├── PaintBrushCursor.tsx
│   │   ├── ResponsiveArchive.tsx
│   │   ├── Sidebar.tsx
│   │   ├── StudentFooter.tsx
│   │   ├── StudentFooterWrapper.tsx
│   │   ├── SubjectCard.tsx
│   │   ├── TaskCard.tsx
│   │   ├── WelcomeOverlay.tsx
│   │   │
│   │   ├── shared/
│   │   │   └── CouponCard.tsx
│   │   │
│   │   ├── student/
│   │   │   └── StudentHelpButton.tsx
│   │   │
│   │   ├── teacher/
│   │   │   ├── ClassesAccordion.tsx
│   │   │   ├── ClassMonitorToggle.tsx
│   │   │   ├── CreateTaskButton.tsx
│   │   │   ├── CreateTaskModal.tsx
│   │   │   ├── EditStudentSheet.tsx
│   │   │   ├── HelpRequestQueue.tsx
│   │   │   ├── StudentTable.tsx
│   │   │   ├── TeacherSidebar.tsx
│   │   │   └── WeeklyScheduleEditor.tsx
│   │   │
│   │   └── ui/
│   │       ├── alert-dialog.tsx
│   │       ├── button.tsx
│   │       ├── CircularProgress.tsx
│   │       ├── color-picker-grid.tsx
│   │       ├── dropdown-menu.tsx
│   │       ├── emoji-picker.tsx
│   │       ├── popover.tsx
│   │       ├── switch.tsx
│   │       └── time-picker.tsx
│   │
│   ├── contexts/
│   │   └── StudentProfileContext.tsx
│   │
│   ├── hooks/
│   │   ├── useMediaQuery.ts
│   │   ├── useStudentProfile.ts
│   │   └── useTimeTracker.ts
│   │
│   └── utils/
│       ├── subject-colors.ts
│       └── supabase/
│           ├── client.ts
│           └── server.ts
│
└── supabase/
    ├── schema.sql
    └── migrations/
        ├── 20260102000000_add_emoji_to_rewards.sql
        ├── 20260102000001_add_rewards_rls_policies.sql
        ├── 20260102000002_add_delete_reward_rpc.sql
        ├── 20260112000000_add_get_student_schedule_rpc.sql
        ├── 20260121000000_fix_get_student_schedule_task_counts.sql
        └── 20260220000000_add_task_library_rls_policies.sql
```
