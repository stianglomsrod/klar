import { isAuthorizationError } from "@/server/auth/errors";

export type ActionFailure = {
  success: false;
  error: string;
  accessEnded?: true;
};

export function authorizationFailure(error: unknown): ActionFailure | null {
  if (!isAuthorizationError(error)) return null;
  if (error.code === "STAFF_ACCESS_ENDED") {
    return { success: false, error: error.message, accessEnded: true };
  }
  return { success: false, error: error.message };
}
