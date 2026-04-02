-- Add sort_order column to help_requests for manual drag-and-drop reordering
ALTER TABLE public.help_requests
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Index for efficient ordering queries
CREATE INDEX IF NOT EXISTS idx_help_requests_pending_sort
  ON public.help_requests (class_id, status, sort_order ASC, created_at ASC)
  WHERE status = 'pending';
