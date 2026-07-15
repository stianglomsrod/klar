import {
  useState,
  useCallback,
  type Dispatch,
  type SetStateAction,
} from "react";
import type {
  ScheduleEntry,
  LessonPlanTask,
  ParsedDocument,
} from "@/app/actions/parse-weekly-plan";

// ── Edit state discriminated union ──

export type EditState =
  | { type: "message"; index: number; value: string }
  | { type: "goalSubject"; index: number; value: string }
  | { type: "goalItem"; goalIndex: number; itemIndex: number; value: string }
  | { type: "homeworkSubject"; index: number; value: string }
  | { type: "homeworkTask"; hwIndex: number; taskIndex: number; value: string }
  | { type: "schedule"; index: number; entry: ScheduleEntry }
  | null;

// ── Hook ──

export function useUkebrevMutators(
  setData: Dispatch<SetStateAction<ParsedDocument | null>>,
) {
  const [editState, setEditState] = useState<EditState>(null);

  // ── Ukebrev-specific mutators ──

  const updateMessage = useCallback(
    (index: number, value: string) => {
      setData((prev) => {
        if (!prev || prev.documentType !== "ukebrev") return prev;
        const msgs = [...prev.generalMessages];
        msgs[index] = value;
        return { ...prev, generalMessages: msgs };
      });
    },
    [setData],
  );

  const updateGoalSubject = useCallback(
    (index: number, value: string) => {
      setData((prev) => {
        if (!prev || prev.documentType !== "ukebrev") return prev;
        return {
          ...prev,
          learningGoals: prev.learningGoals.map((g, i) =>
            i === index ? { ...g, subject: value } : g,
          ),
        };
      });
    },
    [setData],
  );

  const updateGoalItem = useCallback(
    (goalIdx: number, itemIdx: number, value: string) => {
      setData((prev) => {
        if (!prev || prev.documentType !== "ukebrev") return prev;
        return {
          ...prev,
          learningGoals: prev.learningGoals.map((g, i) => {
            if (i !== goalIdx) return g;
            const goals = [...g.goals];
            goals[itemIdx] = value;
            return { ...g, goals };
          }),
        };
      });
    },
    [setData],
  );

  const updateHomeworkSubject = useCallback(
    (index: number, value: string) => {
      setData((prev) => {
        if (!prev || prev.documentType !== "ukebrev") return prev;
        return {
          ...prev,
          homework: prev.homework.map((h, i) =>
            i === index ? { ...h, subject: value } : h,
          ),
        };
      });
    },
    [setData],
  );

  const updateHomeworkTask = useCallback(
    (hwIdx: number, taskIdx: number, value: string) => {
      setData((prev) => {
        if (!prev || prev.documentType !== "ukebrev") return prev;
        return {
          ...prev,
          homework: prev.homework.map((h, i) => {
            if (i !== hwIdx) return h;
            const tasks = [...h.tasks];
            tasks[taskIdx] = value;
            return { ...h, tasks };
          }),
        };
      });
    },
    [setData],
  );

  const updateScheduleEntry = useCallback(
    (index: number, entry: ScheduleEntry) => {
      setData((prev) => {
        if (!prev || prev.documentType !== "ukebrev") return prev;
        return {
          ...prev,
          schedule: prev.schedule.map((s, i) => (i === index ? entry : s)),
        };
      });
    },
    [setData],
  );

  // ── Ukeplanlegger-specific mutator ──

  const updateLessonTask = useCallback(
    (index: number, updated: LessonPlanTask) => {
      setData((prev) => {
        if (!prev || prev.documentType !== "ukeplanlegger") return prev;
        return {
          ...prev,
          tasks: prev.tasks.map((t, i) => (i === index ? updated : t)),
        };
      });
    },
    [setData],
  );

  // ── Dispatch edit-save to the right mutator ──

  const handleEditSave = useCallback(() => {
    if (!editState) return;
    switch (editState.type) {
      case "message":
        updateMessage(editState.index, editState.value);
        break;
      case "goalSubject":
        updateGoalSubject(editState.index, editState.value);
        break;
      case "goalItem":
        updateGoalItem(
          editState.goalIndex,
          editState.itemIndex,
          editState.value,
        );
        break;
      case "homeworkSubject":
        updateHomeworkSubject(editState.index, editState.value);
        break;
      case "homeworkTask":
        updateHomeworkTask(
          editState.hwIndex,
          editState.taskIndex,
          editState.value,
        );
        break;
      case "schedule":
        updateScheduleEntry(editState.index, editState.entry);
        break;
    }
    setEditState(null);
  }, [
    editState,
    updateMessage,
    updateGoalSubject,
    updateGoalItem,
    updateHomeworkSubject,
    updateHomeworkTask,
    updateScheduleEntry,
  ]);

  // ── Dialog title derived from current edit state ──

  const editDialogTitle = (() => {
    if (!editState) return "";
    switch (editState.type) {
      case "message":
        return "Rediger beskjed";
      case "goalSubject":
      case "homeworkSubject":
        return "Rediger fag";
      case "goalItem":
        return "Rediger læringsmål";
      case "homeworkTask":
        return "Rediger lekse";
      case "schedule":
        return "Rediger timeplanoppføring";
    }
  })();

  return {
    editState,
    setEditState,
    handleEditSave,
    editDialogTitle,
    updateLessonTask,
  };
}
