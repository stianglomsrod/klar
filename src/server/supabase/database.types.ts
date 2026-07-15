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
export type StudentTaskStatus = "not_started" | "in_progress" | "completed";
export type HelpRequestStatus =
  | "waiting"
  | "claimed"
  | "resolved"
  | "cancelled"
  | "expired";
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
  | "student_support.update";

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
};

type StudentTaskStateRow = {
  assignment_id: string;
  organization_id: string;
  student_id: string;
  status: StudentTaskStatus;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type HelpRequestRow = {
  id: string;
  organization_id: string;
  class_id: string;
  student_id: string;
  task_assignment_id: string | null;
  status: HelpRequestStatus;
  claimed_by: string | null;
  requested_at: string;
  claimed_at: string | null;
  resolved_at: string | null;
  expires_at: string;
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
  profile_version: "class_pedagogy_v1";
  starts_at: string;
  ends_at: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  source: StaffAssignmentSource;
  created_by: string | null;
  idempotency_key: string;
  request_fingerprint: string;
  expiry_audited_at: string | null;
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
  profile_version: "class_pedagogy_v1";
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
          visible_from?: string;
          due_at?: string | null;
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
          started_at?: string | null;
          completed_at?: string | null;
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
          task_assignment_id?: string | null;
          status?: HelpRequestStatus;
          claimed_by?: string | null;
          requested_at?: string;
          claimed_at?: string | null;
          resolved_at?: string | null;
          expires_at?: string;
          updated_at?: string;
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
          profile_version?: "class_pedagogy_v1";
          starts_at: string;
          ends_at?: string | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
          source: StaffAssignmentSource;
          created_by?: string | null;
          idempotency_key: string;
          request_fingerprint: string;
          expiry_audited_at?: string | null;
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
          profile_version?: "class_pedagogy_v1";
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
      update_student_task_status: {
        Args: {
          p_assignment_id: string;
          p_student_id: string;
          p_status: StudentTaskStatus;
        };
        Returns: StudentTaskStateRow;
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
      publish_plan_to_class: {
        Args: {
          p_class_id: string;
          p_actor_id: string;
          p_staff_assignment_id: string;
          p_tasks: Json;
        };
        Returns: string[];
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
      staff_job_label: StaffJobLabel;
      staff_assignment_source: StaffAssignmentSource;
      staff_capability: StaffCapability;
    };
    CompositeTypes: Record<string, never>;
  };
};
