# Klar Project File Tree

```
klar/
├── .env.local
├── .git/
├── .gitignore
├── .next/
├── eslint.config.mjs
├── FILE_TREE.md
├── next-env.d.ts
├── next.config.ts
├── node_modules/
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
├── DOCUMENTATION_INDEX.md
├── EXECUTIVE_SUMMARY.md
├── FINAL_VERIFICATION_REPORT.md
├── tailwind.config.ts
├── tsconfig.json
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
│   │   │   │   └── page.tsx
│   │   │   │
│   │   │   └── teacher/
│   │   │       ├── layout.tsx
│   │   │       ├── page.tsx
│   │   │       ├── classes/
│   │   │       │   └── page.tsx
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
│   │   ├── CompletionModal.tsx
│   │   ├── ConditionalLayout.tsx
│   │   ├── FlowerPot.tsx
│   │   ├── LevelUpModal.tsx
│   │   ├── Navigation.tsx
│   │   ├── PaintBrushCursor.tsx
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
│   │   │   ├── EditStudentSheet.tsx
│   │   │   ├── HelpRequestQueue.tsx
│   │   │   ├── TaskCreatorModal.tsx
│   │   │   ├── StudentTable.tsx
│   │   │   ├── TeacherSidebar.tsx
│   │   │   └── WeeklyScheduleEditor.tsx
│   │   │
│   │   └── ui/
│   │       ├── CircularProgress.tsx
│   │       ├── popover.tsx
│   │       └── switch.tsx
│   │
│   ├── contexts/
│   │   └── StudentProfileContext.tsx
│   │
│   ├── hooks/
│   │   ├── useStudentProfile.ts
│   │   └── useTimeTracker.ts
│   │
│   └── utils/
│       └── supabase/
│           ├── client.ts
│           └── server.ts
│
└── supabase/
    ├── schema.sql
    └── migrations/
        ├── 20260102000000_add_emoji_to_rewards.sql
        ├── 20260102000001_add_rewards_rls_policies.sql
        └── 20260102000002_add_delete_reward_rpc.sql
```
