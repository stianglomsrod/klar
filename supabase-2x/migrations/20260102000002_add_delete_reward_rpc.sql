-- Create RPC function to delete reward and all related student_rewards
CREATE OR REPLACE FUNCTION delete_reward_and_transactions(reward_id uuid)
RETURNS void AS $$
BEGIN
  -- Delete from student_rewards first
  DELETE FROM public.student_rewards WHERE reward_id = $1;
  
  -- Then delete the reward
  DELETE FROM public.rewards WHERE id = $1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add RLS policies for student_rewards table to allow deletion
ALTER TABLE public.student_rewards ENABLE ROW LEVEL SECURITY;

-- Teachers can delete student_rewards records for their students' rewards
CREATE POLICY "Teachers can delete student_rewards for their rewards"
ON public.student_rewards
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.rewards
    WHERE rewards.id = student_rewards.reward_id
    AND rewards.created_by = auth.uid()
  )
);

-- Grant execute permission on the RPC function
GRANT EXECUTE ON FUNCTION delete_reward_and_transactions(uuid) TO authenticated;
