-- Fix: get_student_schedule now deduplicates overlapping masterplan (week 0)
-- entries when week-specific entries exist for the same time slot.
-- Uses DISTINCT ON to prefer week-specific entries over masterplan entries.

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
  WITH deduped AS (
    -- For each (day, start, end) slot, keep the week-specific entry
    -- over the masterplan entry (week_number = 0).
    SELECT DISTINCT ON (se.day_of_week, se.start_time, se.end_time)
      se.id,
      se.day_of_week,
      se.start_time,
      se.end_time,
      se.subject_id,
      se.custom_title,
      se.week_number
    FROM schedule_entries se
    WHERE se.type = 'lesson'
    AND (
      se.student_id = p_student_id
      OR se.class_id IN (
        SELECT class_id FROM student_profiles WHERE student_profiles.id = p_student_id
      )
    )
    AND (se.week_number = p_current_week_number OR se.week_number = 0 OR se.week_number IS NULL)
    ORDER BY se.day_of_week, se.start_time, se.end_time,
      CASE WHEN se.week_number = p_current_week_number THEN 0 ELSE 1 END
  )
  SELECT
    d.id,
    d.day_of_week,
    d.start_time::TEXT,
    d.end_time::TEXT,
    d.subject_id,
    COALESCE(s.title, d.custom_title, 'Time') AS subject_title,
    COALESCE(s.emoji, '📚') AS emoji,
    COALESCE(s.color_theme, 'gray') AS subject_color,
    COALESCE(
      EXISTS(
        SELECT 1 FROM task_schedule_entries tse
        JOIN tasks t ON tse.task_id = t.id
        WHERE tse.schedule_entry_id = d.id
        AND t.student_id = p_student_id
      ),
      FALSE
    ) AS entry_has_tasks,
    COALESCE(
      EXISTS(
        SELECT 1 FROM tasks t
        WHERE t.subject_id = d.subject_id
        AND t.student_id = p_student_id
        AND t.is_completed = FALSE
        AND NOT EXISTS (
          SELECT 1 FROM task_schedule_entries tse2 WHERE tse2.task_id = t.id
        )
      ),
      FALSE
    ) AS subject_has_tasks,
    d.custom_title,
    COALESCE(d.week_number, 0) AS week_number,
    (
      SELECT COUNT(*)
      FROM task_schedule_entries tse
      JOIN tasks t ON tse.task_id = t.id
      WHERE tse.schedule_entry_id = d.id
      AND t.student_id = p_student_id
    ) AS tasks_total,
    (
      SELECT COUNT(*)
      FROM task_schedule_entries tse
      JOIN tasks t ON tse.task_id = t.id
      WHERE tse.schedule_entry_id = d.id
      AND t.student_id = p_student_id
      AND t.is_completed = TRUE
    ) AS tasks_completed
  FROM deduped d
  LEFT JOIN subjects s ON d.subject_id = s.id
  ORDER BY d.day_of_week, d.start_time;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_student_schedule(UUID, INTEGER) TO authenticated;
