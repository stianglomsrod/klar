export type AuthorizationErrorCode =
  | "INVALID_RESOURCE_ID"
  | "UNAUTHENTICATED"
  | "MFA_REQUIRED"
  | "STAFF_ACCESS_ENDED"
  | "FORBIDDEN"
  | "AUTHORIZATION_LOOKUP_FAILED";

export class AuthorizationError extends Error {
  constructor(
    readonly code: AuthorizationErrorCode,
    readonly status: 400 | 401 | 403 | 500,
    message: string,
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function isAuthorizationError(
  error: unknown,
): error is AuthorizationError {
  return error instanceof AuthorizationError;
}
