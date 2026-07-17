"use client";

import { useState } from "react";
import type {
  StudentProgressSummary,
  StudentTodayTask,
} from "@/server/tasks/task-service";
import type { StudentExperience } from "@/server/students/experience-service";
import type { StudentSessionDay } from "@/server/plans/student-day-service";
import type { StudentHelpState } from "@/server/help/help-service";
import { StudentExperienceControls } from "./StudentExperienceControls";
import { StudentTaskList, type StudentTaskSection } from "./StudentTaskList";

export function StudentTodayPanel({
  tasks,
  initialProgress,
  initialExperience,
  sessionDay,
  helpState,
}: {
  tasks: StudentTodayTask[];
  initialProgress: StudentProgressSummary;
  initialExperience: StudentExperience;
  sessionDay: StudentSessionDay;
  helpState: StudentHelpState;
}) {
  const [experience, setExperience] = useState(initialExperience);
  const plannedTasks = sessionDay.sessions.flatMap((session) => session.tasks);
  const plannedAssignmentIds = new Set(
    plannedTasks.map((task) => task.assignmentId),
  );
  const unplannedTasks = tasks.filter(
    (task) => !plannedAssignmentIds.has(task.assignmentId),
  );
  const sections: StudentTaskSection[] = sessionDay.sessions.map((session) => ({
    id: session.id,
    name: session.title,
    subject: session.subject,
    relation: session.relation,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    assignmentIds: session.tasks.map((task) => task.assignmentId),
  }));
  if (unplannedTasks.length > 0) {
    sections.push({
      id: "unplanned",
      name: "Andre oppgaver",
      subject: null,
      relation: null,
      startsAt: null,
      endsAt: null,
      assignmentIds: unplannedTasks.map((task) => task.assignmentId),
    });
  }
  const allTasks = [...plannedTasks, ...unplannedTasks];

  return (
    <>
      <StudentExperienceControls
        initialExperience={initialExperience}
        onSaved={setExperience}
      />
      <div className="mt-6">
        <StudentTaskList
          initialTasks={allTasks}
          initialProgress={initialProgress}
          experience={experience}
          helpState={helpState}
          sections={sections}
        />
      </div>
    </>
  );
}
