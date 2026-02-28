# Klar Project File Tree

```
klar/
├── .env.local
├── .gitignore
├── DOCUMENTATION_INDEX.md
├── eslint.config.mjs
├── EXECUTIVE_SUMMARY.md
├── FILE_TREE.md
├── FINAL_VERIFICATION_REPORT.md
├── next-env.d.ts
├── next.config.ts
├── package-lock.json
├── package.json
├── postcss.config.mjs
├── PROJECT_DNA.md
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
├── TECH_DEBT.md
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
│   │   │       ├── timeplan/
│   │   │       │   └── page.tsx
│   │   │       └── ukebrev/
│   │   │           └── page.tsx
│   │   │
│   │   ├── actions/
│   │   │   ├── student-actions.ts
│   │   │   ├── manage-subjects.ts
│   │   │   ├── parse-weekly-plan.ts
│   │   │   ├── save-lesson-plan.ts
│   │   │   ├── save-weekly-plan.ts
│   │   │   ├── shared-normalization.ts
│   │   │   └── shared-plan-utils.ts
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
│   │   │   ├── AvatarPickerModal.tsx
│   │   │   ├── FeedbackBubble.tsx
│   │   │   ├── FeedbackSheet.tsx
│   │   │   ├── StudentHelpButton.tsx
│   │   │   ├── StudentQuizView.tsx
│   │   │   └── SubjectProgress.tsx
│   │   │
│   │   ├── teacher/
│   │   │   ├── ActivityDetailSheet.tsx
│   │   │   ├── AddStudentModal.tsx
│   │   │   ├── BulkStudentAssignModal.tsx
│   │   │   ├── ClassCombobox.tsx
│   │   │   ├── ClassesAccordion.tsx
│   │   │   ├── ClassMonitorToggle.tsx
│   │   │   ├── CreateTaskButton.tsx
│   │   │   ├── CreateTaskModal.tsx
│   │   │   ├── EditStudentSheet.tsx
│   │   │   ├── HelpRequestQueue.tsx
│   │   │   ├── QuizBuilder.tsx
│   │   │   ├── RecipientPicker.tsx
│   │   │   ├── MissingDataDialog.tsx
│   │   │   ├── PreviewLessonPlan.tsx
│   │   │   ├── PreviewScheduleGrid.tsx
│   │   │   ├── ScheduleEntryEditDialog.tsx
│   │   │   ├── SchedulePicker.tsx
│   │   │   ├── StudentPasswordCard.tsx
│   │   │   ├── StudentRewardManager.tsx
│   │   │   ├── StudentSettingsCard.tsx
│   │   │   ├── StudentTable.tsx
│   │   │   ├── TeacherSidebar.tsx
│   │   │   └── WeeklyScheduleEditor.tsx
│   │   │
│   │   └── ui/
│   │       ├── alert-dialog.tsx
│   │       ├── AudioRecorder.tsx
│   │       ├── button.tsx
│   │       ├── CircularProgress.tsx
│   │       ├── color-picker-grid.tsx
│   │       ├── dropdown-menu.tsx
│   │       ├── edit-dialog.tsx
│   │       ├── emoji-picker.tsx
│   │       ├── MediaUploadToolbar.tsx
│   │       ├── popover.tsx
│   │       ├── switch.tsx
│   │       ├── time-picker.tsx
│   │       ├── TTSButton.tsx
│   │       └── WebcamCapture.tsx
│   │
│   ├── contexts/
│   │   ├── StudentProfileContext.tsx
│   │   └── TeacherProfileContext.tsx
│   │
│   ├── hooks/
│   │   ├── useMediaQuery.ts
│   │   ├── useStudentProfile.ts
│   │   ├── useTaskCompletion.ts
│   │   ├── useTaskFlow.ts
│   │   ├── useTeacherProfile.ts
│   │   ├── useTimeTracker.ts
│   │   ├── useToast.ts
│   │   └── useTTS.ts
│   │
│   └── utils/
│       ├── constants.ts
│       ├── format-time.ts
│       ├── hero-gradients.ts
│       ├── lesson-time.ts
│       ├── subject-colors.ts
│       ├── week-number.ts
│       └── supabase/
│           ├── client.ts
│           ├── schedule-queries.ts
│           ├── server.ts
│           └── storage.ts
│
└── supabase/
    ├── schema.sql
    └── migrations/
        ├── 20260102000000_add_emoji_to_rewards.sql
        ├── 20260102000001_add_rewards_rls_policies.sql
        ├── 20260102000002_add_delete_reward_rpc.sql
        ├── 20260112000000_add_get_student_schedule_rpc.sql
        ├── 20260121000000_fix_get_student_schedule_task_counts.sql
        ├── 20260220000000_add_task_library_rls_policies.sql
        ├── 20260220000001_rewards_multi_student.sql
        ├── 20260221000001_activity_feed_updates.sql
        ├── 20260221000002_add_quiz_and_media_support.sql
        └── 20260221000003_add_feedback_task_unique_constraint.sql
        ├── 20260222000000_add_earned_at_level_to_student_rewards.sql
        ├── 20260222000001_add_max_level_reached.sql
        ├── 20260222000002_create_student_media_bucket.sql
        ├── 20260222100000_add_feedback_teacher_id_and_read_at.sql
        ├── 20260222200000_add_current_password_plaintext.sql
        └── 20260228000000_add_class_unique_constraint.sql
        └── 20260228000001_add_class_delete_policy.sql
```
