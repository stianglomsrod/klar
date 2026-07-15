-- Create RPC function to get student schedule with task information
CREATE OR REPLACE FUNCTION get_student_schedule(
  student_id UUID,
  current_week_number INTEGER
)
RETURNS TABLE (
  id UUID,
  day_of_week INTEGER,
  start_time TEXT,
  end_time TEXT,
  subject_id UUID,
  subject_title TEXT,
  emoji TEXT,
  entry_has_tasks BOOLEAN,
  subject_has_tasks BOOLEAN,
  custom_title TEXT,
  week_number INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    se.id,
    se.day_of_week,
    se.start_time,
    se.end_time,
    se.subject_id,
    s.title AS subject_title,
    s.emoji,
    -- Check if there are tasks assigned to this student for this schedule entry
    COALESCE(
      EXISTS(
        SELECT 1 FROM task_schedule_entries tse
        JOIN tasks t ON tse.task_id = t.id
        WHERE tse.schedule_entry_id = se.id
        AND t.student_id = student_id
        AND t.is_completed = FALSE
      ),
      FALSE
    ) AS entry_has_tasks,
    -- Check if there are tasks for this subject (not scheduled to specific time)
    COALESCE(
      EXISTS(
        SELECT 1 FROM tasks t
        WHERE t.subject_id = se.subject_id
        AND t.student_id = student_id
        AND t.is_completed = FALSE
        AND t.id NOT IN (
          SELECT task_id FROM task_schedule_entries
        )
      ),
      FALSE
    ) AS subject_has_tasks,
    se.custom_title,
    se.week_number
  FROM schedule_entries se
  LEFT JOIN subjects s ON se.subject_id = s.id
  WHERE se.type = 'lesson'
  AND se.student_id = student_id
  AND (se.week_number = current_week_number OR se.week_number = 0)
  ORDER BY se.day_of_week, se.start_time;
END;
$$ LANGUAGE plpgsql STABLE;
