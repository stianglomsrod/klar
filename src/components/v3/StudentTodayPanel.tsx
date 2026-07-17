"use client";

import { useState } from "react";
import type { StudentTodayTask } from "@/server/tasks/task-service";
import type { StudentExperience } from "@/server/students/experience-service";
import { StudentExperienceControls } from "./StudentExperienceControls";
import { StudentTaskList } from "./StudentTaskList";

export function StudentTodayPanel({
  tasks,
  initialExperience,
}: {
  tasks: StudentTodayTask[];
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
        <StudentTaskList initialTasks={tasks} experience={experience} />
      </div>
    </>
  );
}
