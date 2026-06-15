-- Reconnect the teacher help-queue action to the student "help hand" gate.
--
-- Background:
--   The student footer (StudentFooter.tsx) renders the help-hand only when
--   `classes.is_queue_open = true` for the student's class. The ONLY component
--   that ever wrote that column (ClassMonitorToggle.tsx) is dead code and is no
--   longer rendered. The live teacher toggle (QueueToggle.tsx) writes instead to
--   the newer `active_help_queues` / `help_queue_participants` tables and never
--   touches `classes.is_queue_open`.
--
--   The two systems were only "connected" by stale `is_queue_open = true` values
--   left over on the original class rows. Deleting and recreating classes 7A/7B/7C
--   reset those rows to the column default (false), so the student hand stopped
--   appearing even though teachers were activating the queue.
--
-- Fix:
--   Keep `active_help_queues` as the single source of truth and mirror its state
--   into `classes.is_queue_open` via a trigger. The student footer (and its
--   existing realtime subscription on the `classes` table) then keeps working
--   unchanged, with no RLS or frontend changes required.

-- ── Sync function ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_class_queue_open()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_class uuid;
BEGIN
  -- Works for INSERT (OLD null), UPDATE, and DELETE (NEW null).
  affected_class := COALESCE(NEW.class_id, OLD.class_id);

  IF affected_class IS NOT NULL THEN
    UPDATE public.classes c
    SET is_queue_open = EXISTS (
      SELECT 1
      FROM public.active_help_queues q
      WHERE q.class_id = affected_class
        AND q.status = 'open'
    )
    WHERE c.id = affected_class;
  END IF;

  RETURN NULL;
END;
$$;

-- ── Trigger ────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_sync_class_queue_open ON public.active_help_queues;

CREATE TRIGGER trg_sync_class_queue_open
AFTER INSERT OR DELETE OR UPDATE OF status, class_id
ON public.active_help_queues
FOR EACH ROW
EXECUTE FUNCTION public.sync_class_queue_open();

-- ── Backfill current state ─────────────────────────────
-- Align every class's is_queue_open with whether it currently has an open queue,
-- repairing the recreated 7A/7B/7C rows immediately.
UPDATE public.classes c
SET is_queue_open = EXISTS (
  SELECT 1
  FROM public.active_help_queues q
  WHERE q.class_id = c.id
    AND q.status = 'open'
);
