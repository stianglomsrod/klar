export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type OrganizationRole = "owner" | "teacher" | "student";
export type ClassRole = "teacher" | "student";
export type TaskPublicationStatus = "draft" | "published" | "archived";
export type StudentTaskStatus = "assigned" | "completed" | "reopened";
export type TaskProgressCommand = "complete" | "undo" | "reopen" | "legacy_backfill";
export type TaskReopenReason =
  | "continue_working"
  | "completed_by_mistake"
  | "needs_review"
  | "other";
export type XpLedgerKind = "credit" | "reversal";
export type RewardEntitlementStatus = "pending" | "available" | "selected";
export type HelpRequestStatus =
  | "waiting"
  | "claimed"
  | "resolved"
  | "cancelled"
  | "expired";
export type HelpQueueSessionStatus = "open" | "closing" | "closed";
export type HelpQueuePriorityReason =
  | "support_needed_now"
  | "short_clarification"
  | "staff_coordination";
export type StaffJobLabel =
  | "contact_teacher"
  | "subject_teacher"
  | "special_educator"
  | "substitute"
  | "legacy_teacher"
  | "operational_owner";
export type StaffAssignmentSource =
  | "manual"
  | "legacy_backfill"
  | "class_creation";
export type StaffCapability =
  | "class.workspace.read"
  | "task.publish"
  | "plan.preview"
  | "plan.publish"
  | "help_queue.manage"
  | "student_support.update"
  | "student_progress.read"
  | "task.return";
export type StaffCapabilityProfile = "class_pedagogy_v1" | "class_pedagogy_v2";

type TableDefinition<Row, Insert> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Insert>;
  Relationships: [];
};

type ProfileRow = {
  id: string;
  display_name: string;
  created_at: string;
  updated_at: string;
};

type OrganizationRow = {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type MembershipRow = {
  organization_id: string;
  user_id: string;
  role: OrganizationRole;
  created_by: string | null;
  created_at: string;
};

type ClassRow = {
  id: string;
  organization_id: string;
  name: string;
  academic_year: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

type ClassMembershipRow = {
  class_id: string;
  organization_id: string;
  user_id: string;
  role: ClassRole;
  created_by: string | null;
  created_at: string;
};

type TaskDefinitionRow = {
  id: string;
  organization_id: string;
  class_id: string;
  title: string;
  description: string | null;
  subject: string | null;
  estimated_minutes: number | null;
  support_level: number;
  position: number;
  publication_status: TaskPublicationStatus;
  created_by: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  points_value: number;
};

type TaskAssignmentRow = {
  id: string;
  organization_id: string;
  class_id: string;
  task_definition_id: string;
  student_id: string;
  assigned_by: string;
  visible_from: string;
  due_at: string | null;
  created_at: string;
  points_value_snapshot: number;
  plan_task_id: string | null;
  source_plan_revision_task_id: string | null;
};

type WeeklyPlanRow = {
  id: string;
  organization_id: string;
  class_id: string;
  week_start_date: string;
  timezone_name: "Europe/Oslo";
  active_revision_id: string | null;
  lock_version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type PlanRevisionSessionRow = {
  id: string;
  revision_id: string;
  weekly_plan_id: string;
  organization_id: string;
  class_id: string;
  teaching_session_id: string;
  title: string;
  subject: string | null;
  starts_at: string;
  ends_at: string;
  position: number;
  created_at: string;
};

type StudentTaskStateRow = {
  assignment_id: string;
  organization_id: string;
  student_id: string;
  status: StudentTaskStatus;
  completed_at: string | null;
  state_version: number;
  completion_sequence: number;
  reopened_at: string | null;
  active_completion_attempt_id: string | null;
  last_transition_id: string | null;
  created_at: string;
  updated_at: string;
};

type HelpRequestRow = {
  id: string;
  organization_id: string;
  class_id: string;
  student_id: string;
  queue_session_id: string | null;
  task_assignment_id: string | null;
  status: HelpRequestStatus;
  claimed_by: string | null;
  requested_at: string;
  claimed_at: string | null;
  ownership_changed_at: string | null;
  ownership_version: number;
  resolved_at: string | null;
  expires_at: string;
  updated_at: string;
};

type HelpQueueSessionRow = {
  id: string;
  organization_id: string;
  class_id: string;
  revision_session_id: string;
  status: HelpQueueSessionStatus;
  lock_version: number;
  activity_version: number;
  opened_at: string;
  closing_started_at: string | null;
  closed_at: string | null;
  updated_at: string;
};

type HelpQueueCommandReceiptRow = {
  organization_id: string;
  actor_id: string;
  request_id: string;
  command:
    | "open_queue"
    | "close_queue"
    | "request_help"
    | "cancel_help"
    | "claim_help"
    | "resolve_help"
    | "reorder_help"
    | "release_help"
    | "transfer_help";
  request_fingerprint: string;
  queue_session_id: string;
  result: Json;
  created_at: string;
};

type HelpQueueSignalRow = {
  id: string;
  organization_id: string;
  class_id: string;
  queue_session_id: string | null;
  student_id: string | null;
  signal_version: number;
  updated_at: string;
  staff_only: boolean;
};

type HelpQueueRequestOrderRow = {
  request_id: string;
  organization_id: string;
  class_id: string;
  queue_session_id: string;
  position: number | null;
  active: boolean;
  last_changed_by: string | null;
  last_changed_at: string | null;
  last_reason_code: HelpQueuePriorityReason | null;
  created_at: string;
  updated_at: string;
};

type AuditEventRow = {
  id: number;
  organization_id: string;
  actor_id: string | null;
  event_name: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Json;
  occurred_at: string;
  authorizing_staff_assignment_id: string | null;
  authorizing_capability: StaffCapability | null;
};

type StaffAssignmentRow = {
  id: string;
  organization_id: string;
  user_id: string;
  job_label: StaffJobLabel;
  profile_version: StaffCapabilityProfile;
  starts_at: string;
  ends_at: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  source: StaffAssignmentSource;
  created_by: string | null;
  idempotency_key: string;
  request_fingerprint: string;
  expiry_audited_at: string | null;
  profile_sealed_at: string | null;
  version: number;
  created_at: string;
};

type StaffAssignmentClassScopeRow = {
  assignment_id: string;
  organization_id: string;
  class_id: string;
  created_at: string;
};

type StaffAssignmentCapabilityRow = {
  assignment_id: string;
  capability: StaffCapability;
  profile_version: StaffCapabilityProfile;
  created_at: string;
};

type StudentLoginCodeRow = {
  user_id: string;
  organization_id: string;
  code_digest: string;
  created_by: string;
  created_at: string;
  last_used_at: string | null;
  disabled_at: string | null;
};

type StudentExperienceSettingsRow = {
  organization_id: string;
  student_id: string;
  support_level: number;
  progress_enabled: boolean;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

type TaskCompletionAttemptRow = {
  id: string;
  organization_id: string;
  class_id: string;
  assignment_id: string;
  student_id: string;
  sequence: number;
  points_value_snapshot: number;
  request_id: string;
  completed_by: string;
  completed_at: string;
};

type TaskStateTransitionRow = {
  id: string;
  organization_id: string;
  class_id: string;
  assignment_id: string;
  student_id: string;
  from_status: StudentTaskStatus;
  to_status: StudentTaskStatus;
  command: TaskProgressCommand;
  completion_attempt_id: string;
  request_id: string;
  actor_id: string;
  staff_assignment_id: string | null;
  reason_code: TaskReopenReason | null;
  student_message: string | null;
  occurred_at: string;
};

type StudentXpLedgerRow = {
  id: string;
  organization_id: string;
  class_id: string;
  student_id: string;
  assignment_id: string;
  completion_attempt_id: string;
  entry_kind: XpLedgerKind;
  points_delta: number;
  reverses_entry_id: string | null;
  request_id: string;
  actor_id: string;
  occurred_at: string;
};

type StudentProgressRow = {
  organization_id: string;
  student_id: string;
  xp_balance: number;
  current_level: number;
  highest_level: number;
  scheme_version: "linear_1000_v1";
  updated_at: string;
};

type LevelMilestoneRow = {
  id: string;
  organization_id: string;
  student_id: string;
  level: number;
  first_completion_attempt_id: string;
  first_reached_at: string;
};

type LevelRewardEntitlementRow = {
  id: string;
  organization_id: string;
  student_id: string;
  level: number;
  milestone_id: string;
  status: RewardEntitlementStatus;
  available_at: string | null;
  selected_at: string | null;
  created_at: string;
  updated_at: string;
};

type ProgressCommandReceiptRow = {
  organization_id: string;
  class_id: string;
  assignment_id: string;
  student_id: string;
  actor_id: string;
  request_id: string;
  command: TaskProgressCommand;
  request_fingerprint: string;
  result: Json;
  created_at: string;
  completed_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: TableDefinition<
        ProfileRow,
        {
          id: string;
          display_name: string;
          created_at?: string;
          updated_at?: string;
        }
      >;
      organizations: TableDefinition<
        OrganizationRow,
        {
          id?: string;
          name: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        }
      >;
      memberships: TableDefinition<
        MembershipRow,
        {
          organization_id: string;
          user_id: string;
          role: OrganizationRole;
          created_by?: string | null;
          created_at?: string;
        }
      >;
      classes: TableDefinition<
        ClassRow,
        {
          id?: string;
          organization_id: string;
          name: string;
          academic_year?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        }
      >;
      class_memberships: TableDefinition<
        ClassMembershipRow,
        {
          class_id: string;
          organization_id: string;
          user_id: string;
          role: ClassRole;
          created_by?: string | null;
          created_at?: string;
        }
      >;
      task_definitions: TableDefinition<
        TaskDefinitionRow,
        {
          id?: string;
          organization_id: string;
          class_id: string;
          title: string;
          description?: string | null;
          subject?: string | null;
          estimated_minutes?: number | null;
          support_level?: number;
          position?: number;
          points_value?: number;
          publication_status?: TaskPublicationStatus;
          created_by: string;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      task_assignments: TableDefinition<
        TaskAssignmentRow,
        {
          id?: string;
          organization_id: string;
          class_id: string;
          task_definition_id: string;
          student_id: string;
          assigned_by: string;
          points_value_snapshot?: number;
          visible_from?: string;
          due_at?: string | null;
          created_at?: string;
          plan_task_id?: string | null;
          source_plan_revision_task_id?: string | null;
        }
      >;
      weekly_plans: TableDefinition<
        WeeklyPlanRow,
        {
          id?: string;
          organization_id: string;
          class_id: string;
          week_start_date: string;
          timezone_name?: "Europe/Oslo";
          active_revision_id?: string | null;
          lock_version?: number;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        }
      >;
      plan_revision_sessions: TableDefinition<
        PlanRevisionSessionRow,
        {
          id?: string;
          revision_id: string;
          weekly_plan_id: string;
          organization_id: string;
          class_id: string;
          teaching_session_id: string;
          title: string;
          subject?: string | null;
          starts_at: string;
          ends_at: string;
          position: number;
          created_at?: string;
        }
      >;
      student_task_state: TableDefinition<
        StudentTaskStateRow,
        {
          assignment_id: string;
          organization_id: string;
          student_id: string;
          status?: StudentTaskStatus;
          completed_at?: string | null;
          state_version?: number;
          completion_sequence?: number;
          reopened_at?: string | null;
          active_completion_attempt_id?: string | null;
          last_transition_id?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      help_requests: TableDefinition<
        HelpRequestRow,
        {
          id?: string;
          organization_id: string;
          class_id: string;
          student_id: string;
          queue_session_id?: string | null;
          task_assignment_id?: string | null;
          status?: HelpRequestStatus;
          claimed_by?: string | null;
          requested_at?: string;
          claimed_at?: string | null;
          ownership_changed_at?: string | null;
          ownership_version?: number;
          resolved_at?: string | null;
          expires_at?: string;
          updated_at?: string;
        }
      >;
      help_queue_sessions: TableDefinition<
        HelpQueueSessionRow,
        {
          id?: string;
          organization_id: string;
          class_id: string;
          revision_session_id: string;
          status?: HelpQueueSessionStatus;
          lock_version?: number;
          activity_version?: number;
          opened_at?: string;
          closing_started_at?: string | null;
          closed_at?: string | null;
          updated_at?: string;
        }
      >;
      help_queue_signals: TableDefinition<
        HelpQueueSignalRow,
        {
          id?: string;
          organization_id: string;
          class_id: string;
          queue_session_id?: string | null;
          student_id?: string | null;
          signal_version?: number;
          updated_at?: string;
          staff_only?: boolean;
        }
      >;
      help_queue_request_order: TableDefinition<
        HelpQueueRequestOrderRow,
        {
          request_id: string;
          organization_id: string;
          class_id: string;
          queue_session_id: string;
          position?: number | null;
          active?: boolean;
          last_changed_by?: string | null;
          last_changed_at?: string | null;
          last_reason_code?: HelpQueuePriorityReason | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      help_queue_command_receipts: TableDefinition<
        HelpQueueCommandReceiptRow,
        {
          organization_id: string;
          actor_id: string;
          request_id: string;
          command: HelpQueueCommandReceiptRow["command"];
          request_fingerprint: string;
          queue_session_id: string;
          result: Json;
          created_at?: string;
        }
      >;
      audit_events: TableDefinition<
        AuditEventRow,
        {
          id?: never;
          organization_id: string;
          actor_id?: string | null;
          event_name: string;
          entity_type: string;
          entity_id?: string | null;
          metadata?: Json;
          occurred_at?: string;
          authorizing_staff_assignment_id?: string | null;
          authorizing_capability?: StaffCapability | null;
        }
      >;
      staff_assignments: TableDefinition<
        StaffAssignmentRow,
        {
          id?: string;
          organization_id: string;
          user_id: string;
          job_label: StaffJobLabel;
          profile_version?: StaffCapabilityProfile;
          starts_at: string;
          ends_at?: string | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
          source: StaffAssignmentSource;
          created_by?: string | null;
          idempotency_key: string;
          request_fingerprint: string;
          expiry_audited_at?: string | null;
          profile_sealed_at?: never;
          version?: number;
          created_at?: string;
        }
      >;
      staff_assignment_class_scopes: TableDefinition<
        StaffAssignmentClassScopeRow,
        {
          assignment_id: string;
          organization_id: string;
          class_id: string;
          created_at?: string;
        }
      >;
      staff_assignment_capabilities: TableDefinition<
        StaffAssignmentCapabilityRow,
        {
          assignment_id: string;
          capability: StaffCapability;
          profile_version?: StaffCapabilityProfile;
          created_at?: string;
        }
      >;
      student_login_codes: TableDefinition<
        StudentLoginCodeRow,
        {
          user_id: string;
          organization_id: string;
          code_digest: string;
          created_by: string;
          created_at?: string;
          last_used_at?: string | null;
          disabled_at?: string | null;
        }
      >;
      student_experience_settings: TableDefinition<
        StudentExperienceSettingsRow,
        {
          organization_id: string;
          student_id: string;
          support_level?: number;
          progress_enabled?: boolean;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      task_completion_attempts: TableDefinition<
        TaskCompletionAttemptRow,
        {
          id?: string;
          organization_id: string;
          class_id: string;
          assignment_id: string;
          student_id: string;
          sequence: number;
          points_value_snapshot: number;
          request_id: string;
          completed_by: string;
          completed_at?: string;
        }
      >;
      task_state_transitions: TableDefinition<
        TaskStateTransitionRow,
        {
          id?: string;
          organization_id: string;
          class_id: string;
          assignment_id: string;
          student_id: string;
          from_status: StudentTaskStatus;
          to_status: StudentTaskStatus;
          command: TaskProgressCommand;
          completion_attempt_id: string;
          request_id: string;
          actor_id: string;
          staff_assignment_id?: string | null;
          reason_code?: TaskReopenReason | null;
          student_message?: string | null;
          occurred_at?: string;
        }
      >;
      student_xp_ledger: TableDefinition<
        StudentXpLedgerRow,
        {
          id?: string;
          organization_id: string;
          class_id: string;
          student_id: string;
          assignment_id: string;
          completion_attempt_id: string;
          entry_kind: XpLedgerKind;
          points_delta: number;
          reverses_entry_id?: string | null;
          request_id: string;
          actor_id: string;
          occurred_at?: string;
        }
      >;
      student_progress: TableDefinition<
        StudentProgressRow,
        {
          organization_id: string;
          student_id: string;
          xp_balance?: number;
          current_level?: number;
          highest_level?: number;
          scheme_version?: "linear_1000_v1";
          updated_at?: string;
        }
      >;
      level_milestones: TableDefinition<
        LevelMilestoneRow,
        {
          id?: string;
          organization_id: string;
          student_id: string;
          level: number;
          first_completion_attempt_id: string;
          first_reached_at?: string;
        }
      >;
      level_reward_entitlements: TableDefinition<
        LevelRewardEntitlementRow,
        {
          id?: string;
          organization_id: string;
          student_id: string;
          level: number;
          milestone_id: string;
          status: RewardEntitlementStatus;
          available_at?: string | null;
          selected_at?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      progress_command_receipts: TableDefinition<
        ProgressCommandReceiptRow,
        {
          organization_id: string;
          class_id: string;
          assignment_id: string;
          student_id: string;
          actor_id: string;
          request_id: string;
          command: TaskProgressCommand;
          request_fingerprint: string;
          result: Json;
          created_at?: string;
          completed_at?: string;
        }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      is_organization_member: {
        Args: { p_organization_id: string };
        Returns: boolean;
      };
      has_organization_role: {
        Args: { p_organization_id: string; p_roles: OrganizationRole[] };
        Returns: boolean;
      };
      has_class_role: {
        Args: { p_class_id: string; p_roles: ClassRole[] };
        Returns: boolean;
      };
      can_access_class: {
        Args: { p_class_id: string };
        Returns: boolean;
      };
      can_view_profile: {
        Args: { p_profile_id: string };
        Returns: boolean;
      };
      can_view_membership: {
        Args: { p_organization_id: string; p_user_id: string };
        Returns: boolean;
      };
      can_view_task_definition: {
        Args: { p_task_definition_id: string };
        Returns: boolean;
      };
      create_class_for_teacher: {
        Args: {
          p_organization_id: string;
          p_actor_id: string;
          p_name: string;
          p_academic_year?: string | null;
        };
        Returns: string;
      };
      publish_task_to_class: {
        Args: {
          p_class_id: string;
          p_actor_id: string;
          p_staff_assignment_id: string;
          p_title: string;
          p_description?: string | null;
          p_subject?: string | null;
          p_estimated_minutes?: number | null;
          p_support_level?: number;
          p_due_at?: string | null;
          p_visible_from?: string;
        };
        Returns: string;
      };
      complete_student_task: {
        Args: {
          p_assignment_id: string;
          p_student_id: string;
          p_request_id: string;
        };
        Returns: Json;
      };
      undo_student_task_completion: {
        Args: {
          p_assignment_id: string;
          p_student_id: string;
          p_request_id: string;
        };
        Returns: Json;
      };
      reopen_student_task_for_staff: {
        Args: {
          p_assignment_id: string;
          p_actor_id: string;
          p_staff_assignment_id: string;
          p_request_id: string;
          p_reason_code: TaskReopenReason;
          p_student_message?: string | null;
        };
        Returns: Json;
      };
      can_read_task_progress_resource: {
        Args: {
          p_organization_id: string;
          p_class_id: string;
          p_student_id: string;
        };
        Returns: boolean;
      };
      can_read_student_progress_identity: {
        Args: { p_organization_id: string; p_student_id: string };
        Returns: boolean;
      };
      expire_help_requests: {
        Args: Record<string, never>;
        Returns: number;
      };
      request_student_help: {
        Args: {
          p_class_id: string;
          p_student_id: string;
          p_task_assignment_id?: string | null;
        };
        Returns: HelpRequestRow;
      };
      cancel_student_help: {
        Args: { p_request_id: string; p_student_id: string };
        Returns: HelpRequestRow;
      };
      claim_student_help: {
        Args: {
          p_request_id: string;
          p_teacher_id: string;
          p_staff_assignment_id: string;
        };
        Returns: HelpRequestRow;
      };
      resolve_student_help: {
        Args: {
          p_request_id: string;
          p_teacher_id: string;
          p_staff_assignment_id: string;
        };
        Returns: HelpRequestRow;
      };
      reconcile_help_queue_sessions: {
        Args: { p_class_id?: string | null };
        Returns: number;
      };
      open_help_queue_session: {
        Args: {
          p_class_id: string;
          p_revision_session_id: string;
          p_actor_id: string;
          p_staff_assignment_id: string;
          p_request_id: string;
        };
        Returns: Json;
      };
      begin_close_help_queue_session: {
        Args: {
          p_queue_session_id: string;
          p_expected_version: number;
          p_actor_id: string;
          p_staff_assignment_id: string;
          p_request_id: string;
        };
        Returns: Json;
      };
      request_student_help_v2: {
        Args: {
          p_queue_session_id: string;
          p_student_id: string;
          p_request_id: string;
          p_task_assignment_id?: string | null;
        };
        Returns: Json;
      };
      cancel_student_help_v2: {
        Args: {
          p_request_id: string;
          p_student_id: string;
          p_command_request_id: string;
        };
        Returns: Json;
      };
      claim_student_help_v2: {
        Args: {
          p_request_id: string;
          p_actor_id: string;
          p_staff_assignment_id: string;
          p_command_request_id: string;
        };
        Returns: Json;
      };
      resolve_student_help_v2: {
        Args: {
          p_request_id: string;
          p_actor_id: string;
          p_staff_assignment_id: string;
          p_command_request_id: string;
        };
        Returns: Json;
      };
      claim_student_help_v3: {
        Args: {
          p_request_id: string;
          p_expected_ownership_version: number;
          p_actor_id: string;
          p_staff_assignment_id: string;
          p_command_request_id: string;
        };
        Returns: Json;
      };
      resolve_student_help_v3: {
        Args: {
          p_request_id: string;
          p_expected_ownership_version: number;
          p_actor_id: string;
          p_staff_assignment_id: string;
          p_command_request_id: string;
        };
        Returns: Json;
      };
      read_help_queue_staff_snapshot_v1: {
        Args: {
          p_organization_id: string;
          p_class_id: string;
          p_queue_session_id: string;
        };
        Returns: Json;
      };
      reorder_student_help_v1: {
        Args: {
          p_queue_session_id: string;
          p_request_id: string;
          p_direction: "first" | "up" | "down";
          p_reason_code: HelpQueuePriorityReason;
          p_expected_activity_version: number;
          p_actor_id: string;
          p_staff_assignment_id: string;
          p_command_request_id: string;
        };
        Returns: Json;
      };
      release_student_help_v1: {
        Args: {
          p_request_id: string;
          p_expected_ownership_version: number;
          p_actor_id: string;
          p_staff_assignment_id: string;
          p_command_request_id: string;
        };
        Returns: Json;
      };
      transfer_student_help_v1: {
        Args: {
          p_request_id: string;
          p_expected_ownership_version: number;
          p_actor_id: string;
          p_staff_assignment_id: string;
          p_target_staff_assignment_id: string;
          p_command_request_id: string;
        };
        Returns: Json;
      };
      publish_plan_to_class: {
        Args: {
          p_class_id: string;
          p_actor_id: string;
          p_staff_assignment_id: string;
          p_tasks: Json;
        };
        Returns: string[];
      };
      publish_initial_weekly_plan: {
        Args: {
          p_class_id: string;
          p_actor_id: string;
          p_staff_assignment_id: string;
          p_week_start_date: string;
          p_timezone_name: string;
          p_expected_lock_version: number;
          p_request_id: string;
          p_semantic_hash: string;
          p_candidate: Json;
        };
        Returns: Json;
      };
      get_student_day_projection_at: {
        Args: {
          p_organization_id: string;
          p_student_id: string;
          p_reference_at: string;
        };
        Returns: Json;
      };
      get_my_student_day_v1: {
        Args: { p_organization_id: string };
        Returns: Json;
      };
      update_student_experience: {
        Args: {
          p_organization_id: string;
          p_student_id: string;
          p_actor_id: string;
          p_support_level: number;
          p_progress_enabled: boolean;
        };
        Returns: StudentExperienceSettingsRow;
      };
      update_student_experience_for_staff: {
        Args: {
          p_organization_id: string;
          p_class_id: string;
          p_student_id: string;
          p_actor_id: string;
          p_staff_assignment_id: string;
          p_support_level: number;
          p_progress_enabled: boolean;
        };
        Returns: StudentExperienceSettingsRow;
      };
      resolve_active_staff_assignment: {
        Args: {
          p_actor_id: string;
          p_class_id: string;
          p_capability: StaffCapability;
        };
        Returns: string | null;
      };
      reconcile_expired_staff_assignments: {
        Args: { p_organization_id?: string | null };
        Returns: number;
      };
      create_staff_assignment: {
        Args: {
          p_organization_id: string;
          p_actor_id: string;
          p_target_user_id: string;
          p_class_id: string;
          p_job_label: StaffJobLabel;
          p_starts_at: string;
          p_ends_at: string;
          p_idempotency_key: string;
        };
        Returns: string;
      };
      revoke_staff_assignment: {
        Args: {
          p_organization_id: string;
          p_actor_id: string;
          p_assignment_id: string;
        };
        Returns: StaffAssignmentRow;
      };
    };
    Enums: {
      organization_role: OrganizationRole;
      class_role: ClassRole;
      task_publication_status: TaskPublicationStatus;
      student_task_status: StudentTaskStatus;
      help_request_status: HelpRequestStatus;
      help_queue_session_status: HelpQueueSessionStatus;
      help_queue_priority_reason: HelpQueuePriorityReason;
      staff_job_label: StaffJobLabel;
      staff_assignment_source: StaffAssignmentSource;
      staff_capability: StaffCapability;
      task_progress_command: TaskProgressCommand;
      task_reopen_reason: TaskReopenReason;
      xp_ledger_kind: XpLedgerKind;
      reward_entitlement_status: RewardEntitlementStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
