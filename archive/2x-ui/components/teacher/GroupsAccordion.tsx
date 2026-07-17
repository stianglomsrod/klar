"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  ChevronDown,
  ChevronRight,
  Users,
  Trash2,
  Pencil,
  Plus,
  Loader2,
  MoreVertical,
} from "lucide-react";
import { isImageUrl } from "@/utils/avatar";
import { useToast } from "@/hooks/useToast";
import Toast from "@/components/ui/Toast";
import QueueToggle from "./QueueToggle";
import { getMyActiveQueues } from "@/app/actions/queue-actions";
import ConfirmDialog, {
  type ConfirmDialogState,
} from "@/components/ui/ConfirmDialog";
import { EditDialog } from "@/components/ui/edit-dialog";
import CreateGroupModal from "./CreateGroupModal";
import StudentContextMenu from "@/components/shared/StudentContextMenu";
import MoveStudentToGroupDialog from "@/components/shared/MoveStudentToGroupDialog";

type GroupStudent = {
  id: string;
  full_name: string;
  avatar_url: string | null;
};

type StudentGroup = {
  id: string;
  name: string;
  members: GroupStudent[];
};

type GroupsAccordionProps = {
  teacherId: string;
  searchQuery?: string;
  onStudentClick?: (student: GroupStudent) => void;
};

export default function GroupsAccordion({
  teacherId,
  searchQuery = "",
  onStudentClick,
}: GroupsAccordionProps) {
  const router = useRouter();
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [editGroupName, setEditGroupName] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null);
  // ── Multiplayer queue participation state ──────────
  const [activeQueueTargets, setActiveQueueTargets] = useState<Set<string>>(
    new Set(),
  );
  // ── Student context menu state ────────────────────
  const [openMenu, setOpenMenu] = useState<{
    studentId: string;
    groupId: string;
    groupName: string;
    student: GroupStudent;
    position: { x: number; y: number };
  } | null>(null);
  // ── Move student dialog state ─────────────────────
  const [moveTarget, setMoveTarget] = useState<{
    studentId: string;
    studentName: string;
    groupId: string;
    groupName: string;
  } | null>(null);
  const { toast, showToast, hideToast } = useToast();
  const supabase = createClient();

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch groups owned by this teacher
      const { data: groupsData, error: groupsError } = await supabase
        .from("student_groups")
        .select("id, name")
        .eq("created_by", teacherId)
        .order("name", { ascending: true });

      if (groupsError) throw groupsError;

      if (!groupsData || groupsData.length === 0) {
        setGroups([]);
        setLoading(false);
        return;
      }

      // Fetch all members for these groups
      const groupIds = groupsData.map((g) => g.id);
      const { data: membersData, error: membersError } = await supabase
        .from("student_group_members")
        .select(
          `
          group_id,
          student_id,
          profile:profiles (
            id,
            full_name,
            avatar_url
          )
        `,
        )
        .in("group_id", groupIds);

      if (membersError) throw membersError;

      // Map members into groups
      const membersByGroup: Record<string, GroupStudent[]> = {};
      (membersData || []).forEach((row: any) => {
        const gId = row.group_id;
        if (!membersByGroup[gId]) membersByGroup[gId] = [];
        if (row.profile) {
          membersByGroup[gId].push({
            id: row.profile.id,
            full_name: row.profile.full_name,
            avatar_url: row.profile.avatar_url,
          });
        }
      });

      const mapped: StudentGroup[] = groupsData.map((g) => ({
        id: g.id,
        name: g.name,
        members: (membersByGroup[g.id] || []).sort((a, b) =>
          a.full_name.localeCompare(b.full_name, "nb"),
        ),
      }));

      setGroups(mapped);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, [supabase, teacherId]);

  useEffect(() => {
    if (teacherId) fetchGroups();
  }, [fetchGroups, teacherId]);

  // Fetch which queues this teacher participates in
  useEffect(() => {
    getMyActiveQueues().then((queues) => {
      setActiveQueueTargets(new Set(queues.map((q) => q.targetId)));
    });
  }, []);

  const handleQueueToggled = (targetId: string, newState: boolean) => {
    setActiveQueueTargets((prev) => {
      const next = new Set(prev);
      if (newState) next.add(targetId);
      else next.delete(targetId);
      return next;
    });
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  // ── Student context menu handlers ─────────────────
  const handleStudentMenuClick = (
    e: React.MouseEvent,
    student: GroupStudent,
    groupId: string,
    groupName: string,
  ) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setOpenMenu({
      studentId: student.id,
      groupId,
      groupName,
      student,
      position: { x: rect.right - 200, y: rect.bottom + 5 },
    });
  };

  const handleStudentMenuAction = (action: string) => {
    if (!openMenu) return;
    const { studentId, student, groupId, groupName } = openMenu;
    setOpenMenu(null);

    switch (action) {
      case "view-profile":
        router.push(`/teacher/students/${studentId}`);
        break;
      case "edit-student":
        onStudentClick?.(student);
        break;
      case "move-student":
        setMoveTarget({
          studentId,
          studentName: student.full_name,
          groupId,
          groupName,
        });
        break;
      case "remove-student":
        setConfirmDialog({
          title: "Fjern fra gruppe",
          description: `Er du sikker på at du vil fjerne ${student.full_name} fra "${groupName}"?`,
          action: async () => {
            const { error } = await supabase
              .from("student_group_members")
              .delete()
              .eq("group_id", groupId)
              .eq("student_id", studentId);
            if (error) {
              showToast("Kunne ikke fjerne eleven", "error");
            } else {
              showToast(
                `${student.full_name} fjernet fra "${groupName}"`,
                "success",
              );
              fetchGroups();
            }
          },
        });
        break;
    }
  };

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = () => setOpenMenu(null);
    if (openMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [openMenu]);

  const handleDeleteGroup = (group: StudentGroup) => {
    setConfirmDialog({
      title: "Slett gruppe",
      description: `Er du sikker på at du vil slette gruppen "${group.name}"? Elevene fjernes fra gruppen, men slettes ikke.`,
      action: async () => {
        const { error } = await supabase
          .from("student_groups")
          .delete()
          .eq("id", group.id);
        if (error) {
          showToast("Kunne ikke slette gruppen", "error");
        } else {
          showToast(`Gruppen "${group.name}" er slettet`, "success");
          fetchGroups();
        }
      },
    });
  };

  const handleRenameGroup = async () => {
    if (!editingGroup || !editGroupName.trim()) return;
    const { error } = await supabase
      .from("student_groups")
      .update({ name: editGroupName.trim() })
      .eq("id", editingGroup.id);
    if (error) {
      showToast("Kunne ikke endre navn", "error");
    } else {
      showToast(`Gruppenavn endret til "${editGroupName.trim()}"`, "success");
      setEditingGroup(null);
      fetchGroups();
    }
  };

  // Filter groups based on search
  const filteredGroups = searchQuery.trim()
    ? groups
        .map((g) => {
          const q = searchQuery.toLowerCase();
          if (g.name.toLowerCase().includes(q)) return g;
          const filteredMembers = g.members.filter((m) =>
            m.full_name.toLowerCase().includes(q),
          );
          if (filteredMembers.length > 0)
            return { ...g, members: filteredMembers };
          return null;
        })
        .filter((g): g is StudentGroup => g !== null)
    : groups;

  // Auto-expand when searching
  useEffect(() => {
    if (searchQuery.trim()) {
      setExpandedGroups(new Set(filteredGroups.map((g) => g.id)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          <p className="text-slate-600">Laster grupper...</p>
        </div>
      </div>
    );
  }

  if (filteredGroups.length === 0 && !searchQuery.trim()) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
        <div className="text-center">
          <Users className="h-12 w-12 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600 mb-2">Ingen grupper opprettet ennå</p>
          <p className="text-sm text-slate-500 mb-4">
            Opprett grupper for å organisere elever på tvers av klasser
          </p>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Opprett ny gruppe
          </button>
        </div>
        {createModalOpen && (
          <CreateGroupModal
            teacherId={teacherId}
            onCreated={() => {
              setCreateModalOpen(false);
              fetchGroups();
            }}
            onClose={() => setCreateModalOpen(false)}
          />
        )}
        <Toast toast={toast} onClose={hideToast} />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Mine Grupper</h3>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          title="Opprett ny gruppe"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Opprett ny gruppe</span>
        </button>
      </div>

      {/* Groups List */}
      <div className="divide-y divide-slate-200">
        {filteredGroups.map((group) => {
          const isExpanded = expandedGroups.has(group.id);

          return (
            <div key={group.id}>
              {/* Group Header */}
              <div className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="flex-1 flex items-center gap-3 text-left"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-slate-400" />
                  )}
                  <Users className="h-5 w-5 text-violet-600" />
                  <span className="font-semibold text-slate-900">
                    {group.name}
                  </span>
                  <span className="ml-auto text-sm text-slate-600">
                    {group.members.length} elever
                  </span>
                </button>

                {/* Hjelpekø toggle + actions */}
                <div className="flex items-center gap-3 ml-3">
                  <QueueToggle
                    targetId={group.id}
                    targetType="group"
                    isActive={activeQueueTargets.has(group.id)}
                    onToggled={(val) => handleQueueToggled(group.id, val)}
                  />

                  {/* Edit button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingGroup({ id: group.id, name: group.name });
                      setEditGroupName(group.name);
                    }}
                    className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
                    title="Rediger gruppenavn"
                  >
                    <Pencil className="h-4 w-4 text-slate-500" />
                  </button>

                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteGroup(group);
                    }}
                    className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    title="Slett gruppe"
                  >
                    <Trash2 className="h-4 w-4 text-slate-400 hover:text-red-500" />
                  </button>
                </div>
              </div>

              {/* Students List */}
              {isExpanded && (
                <div className="bg-slate-50">
                  {group.members.length === 0 ? (
                    <div className="px-4 py-3 pl-12 text-sm text-slate-500">
                      Ingen elever i denne gruppen
                    </div>
                  ) : (
                    group.members.map((student) => (
                      <div
                        key={student.id}
                        className="w-full px-4 py-2 pl-14 flex items-center gap-3 hover:bg-slate-100 transition-colors"
                      >
                        <button
                          onClick={() =>
                            router.push(`/teacher/students/${student.id}`)
                          }
                          className="flex-1 flex items-center gap-3 text-left"
                        >
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-white font-semibold text-xs flex-shrink-0">
                            {isImageUrl(student.avatar_url) ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={student.avatar_url}
                                alt={student.full_name}
                                className="w-full h-full rounded-full object-cover"
                              />
                            ) : (
                              <span className="text-base">
                                {student.avatar_url ||
                                  student.full_name.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-medium text-slate-900 truncate">
                            {student.full_name}
                          </span>
                        </button>
                        <button
                          onClick={(e) =>
                            handleStudentMenuClick(
                              e,
                              student,
                              group.id,
                              group.name,
                            )
                          }
                          className="ml-2 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
                          title="Handlinger"
                        >
                          <MoreVertical className="h-4 w-4 text-slate-600" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create Group Modal */}
      {createModalOpen && (
        <CreateGroupModal
          teacherId={teacherId}
          onCreated={() => {
            setCreateModalOpen(false);
            fetchGroups();
          }}
          onClose={() => setCreateModalOpen(false)}
        />
      )}

      {/* Edit Group Name Dialog */}
      <EditDialog
        open={!!editingGroup}
        onClose={() => setEditingGroup(null)}
        title="Rediger gruppenavn"
        onSave={handleRenameGroup}
      >
        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1.5">
            Nytt gruppenavn
          </label>
          <input
            type="text"
            value={editGroupName}
            onChange={(e) => setEditGroupName(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && editGroupName.trim()) {
                e.preventDefault();
                handleRenameGroup();
              }
            }}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </EditDialog>

      {/* Confirm Dialog */}
      <ConfirmDialog
        state={confirmDialog}
        onClose={() => setConfirmDialog(null)}
        confirmLabel="Fjern"
      />

      {/* Student Context Menu */}
      {openMenu && (
        <StudentContextMenu
          position={openMenu.position}
          items={[
            { label: "Se profil", action: "view-profile" },
            { label: "Rediger", action: "edit-student" },
            { label: "Flytt elev", action: "move-student" },
            { divider: true },
            {
              label: "Fjern fra gruppe",
              action: "remove-student",
              variant: "danger",
            },
          ]}
          onAction={handleStudentMenuAction}
        />
      )}

      {/* Move Student to Group Dialog */}
      {moveTarget && (
        <MoveStudentToGroupDialog
          studentId={moveTarget.studentId}
          studentName={moveTarget.studentName}
          currentGroupId={moveTarget.groupId}
          currentGroupName={moveTarget.groupName}
          teacherId={teacherId}
          onMoved={(newGroupName) => {
            showToast(
              `${moveTarget.studentName} flyttet til "${newGroupName}"`,
              "success",
            );
            setMoveTarget(null);
            fetchGroups();
          }}
          onClose={() => setMoveTarget(null)}
        />
      )}

      <Toast toast={toast} onClose={hideToast} />
    </div>
  );
}
