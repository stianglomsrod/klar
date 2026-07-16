"use client";

import { useState } from "react";
import type {
  StudentProgressSummary,
  StudentTodayTask,
} from "@/server/tasks/task-service";
import type { StudentExperience } from "@/server/students/experience-service";
import { StudentExperienceControls } from "./StudentExperienceControls";
import { StudentTaskList } from "./StudentTaskList";

export function StudentTodayPanel({
  tasks,
  initialProgress,
  initialExperience,
}: {
  tasks: StudentTodayTask[];
  initialProgress: StudentProgressSummary;
  initialExperience: StudentExperience;
}) {
  const [experience, setExperience] = useState(initialExperience);

  return (
    <>
      <StudentExperienceControls
        initialExperience={initialExperience}
        onSaved={setExperience}
      />
      <div className="mt-6">
        <StudentTaskList
          initialTasks={tasks}
          initialProgress={initialProgress}
          experience={experience}
        />
      </div>
    </>
  );
}
