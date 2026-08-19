/**
 * Domain errors for the onboarding workflow. Pure: no transport or persistence concerns.
 * `web/router.ts` maps each to an HTTP status; nothing else should.
 */
export class ApplicationNotFoundError extends Error {
  constructor(publicReference: string) {
    super(`No onboarding application found for reference ${publicReference}`)
  }
}

export class InvalidCaptureLinkError extends Error {
  constructor() {
    super('This capture link is invalid, expired, or has already been used')
  }
}

export class TaskValidationError extends Error {}
