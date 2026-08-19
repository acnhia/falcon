/**
 * Pure progress rules for the 21-activity workflow. No IO - these are the invariants themselves,
 * which is why they live in domain/ rather than beside the D1 queries they used to share a file
 * with. Mirrors ActivityProgressService in the Java reference implementation.
 */
export const TOTAL_ACTIVITIES = 21

export interface ActivityRow {
  activity_number: number
  status: string
  blocked_reason_code: string | null
}

const isDone = (status: string) => status === 'COMPLETED' || status === 'NOT_APPLICABLE'

/** The earliest activity still to be done - where a resumed application picks up. */
export function currentActivityNumber(activities: ActivityRow[]): number {
  const incomplete = activities.find((a) => !isDone(a.status))
  return incomplete ? incomplete.activity_number : TOTAL_ACTIVITIES
}

export function completionPercentage(activities: ActivityRow[]): number {
  if (activities.length === 0) return 0
  return Math.round((activities.filter((a) => isDone(a.status)).length * 100) / activities.length)
}

/** Maps an activity to the wizard screen that presents it. */
export function wizardScreenFor(activityNumber: number): number {
  if (activityNumber <= 2) return 1
  if (activityNumber <= 4) return 2
  if (activityNumber <= 7) return 3
  if (activityNumber <= 10) return 4
  if (activityNumber <= 13) return 5
  if (activityNumber <= 16) return 6
  if (activityNumber <= 19) return 7
  return 8
}
