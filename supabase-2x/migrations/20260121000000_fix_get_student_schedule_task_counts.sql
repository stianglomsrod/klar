-- Fix get_student_schedule RPC to include proper task counts
-- Tasks should ONLY be counted if linked via task_schedule_entries
-- Uses p_ prefix on parameters to avoid column name conflicts

DROP FUNCTION IF EXISTS get_student_schedule(UUID, INTEGER);

CREATE OR REPLACE FUNCTION get_student_schedule(
  p_student_id UUID,
  p_current_week_number INTEGER
)
RETURNS TABLE (
  id UUID,
  day_of_week INTEGER,
  start_time TEXT,
  end_time TEXT,
  subject_id UUID,
  subject_title TEXT,
  emoji TEXT,
  subject_color TEXT,
  entry_has_tasks BOOLEAN,
  subject_has_tasks BOOLEAN,
  custom_title TEXT,
  week_number INTEGER,
  tasks_total BIGINT,
  tasks_completed BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    se.id,
    se.day_of_week,
    se.start_time::TEXT,
    se.end_time::TEXT,
    se.subject_id,
    COALESCE(s.title, se.custom_title, 'Time') AS subject_title,
    COALESCE(s.emoji, '📚') AS emoji,
    COALESCE(s.color_theme, 'gray') AS subject_color,
    -- Check if there are ANY tasks linked to this specific schedule entry
    COALESCE(
      EXISTS(
        SELECT 1 FROM task_schedule_entries tse
        JOIN tasks t ON tse.task_id = t.id
        WHERE tse.schedule_entry_id = se.id
        AND t.student_id = p_student_id
      ),
      FALSE
    ) AS entry_has_tasks,
    -- Check if there are tasks for this subject NOT linked to any schedule entry
    COALESCE(
      EXISTS(
        SELECT 1 FROM tasks t
        WHERE t.subject_id = se.subject_id
        AND t.student_id = p_student_id
        AND t.is_completed = FALSE
        AND NOT EXISTS (
          SELECT 1 FROM task_schedule_entries tse2 WHERE tse2.task_id = t.id
        )
      ),
      FALSE
    ) AS subject_has_tasks,
    se.custom_title,
    COALESCE(se.week_number, 0) AS week_number,
    -- Count TOTAL tasks linked to this specific schedule entry
    (
      SELECT COUNT(*)
      FROM task_schedule_entries tse
      JOIN tasks t ON tse.task_id = t.id
      WHERE tse.schedule_entry_id = se.id
      AND t.student_id = p_student_id
    ) AS tasks_total,
    -- Count COMPLETED tasks linked to this specific schedule entry
    (
      SELECT COUNT(*)
      FROM task_schedule_entries tse
      JOIN tasks t ON tse.task_id = t.id
      WHERE tse.schedule_entry_id = se.id
      AND t.student_id = p_student_id
      AND t.is_completed = TRUE
    ) AS tasks_completed
  FROM schedule_entries se
  LEFT JOIN subjects s ON se.subject_id = s.id
  WHERE se.type = 'lesson'
  AND (
    se.student_id = p_student_id
    OR se.class_id IN (
      SELECT class_id FROM student_profiles WHERE student_profiles.id = p_student_id
    )
  )
  AND (se.week_number = p_current_week_number OR se.week_number = 0 OR se.week_number IS NULL)
  ORDER BY se.day_of_week, se.start_time;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_student_schedule(UUID, INTEGER) TO authenticated;
