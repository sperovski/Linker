import { ApplicationStatus } from '../core/models';

/** Human label for a status — only UnderReview differs from its enum name. */
export function statusLabel(status: ApplicationStatus | 'All'): string {
  return status === 'UnderReview' ? 'Under review' : status;
}
