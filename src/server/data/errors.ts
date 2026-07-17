export class PrototypeDataError extends Error {
  constructor(message = "Kunne ikke hente eller lagre prototypedata.") {
    super(message);
    this.name = "PrototypeDataError";
  }
}

export function isPrototypeDataError(
  error: unknown,
): error is PrototypeDataError {
  return error instanceof PrototypeDataError;
}
