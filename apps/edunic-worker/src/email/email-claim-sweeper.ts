import type { Queue } from 'bullmq';
import {
  emailJobId,
  reclaimJobId,
  type EmailDeliveryJob,
  type EmailDeliveriesRepository,
} from '@edunic/source/domain/notifications';
import { EMAIL_JOB_NAME } from './bullmq-email-queue.js';

// OC-R1 (P8): the reclaim path for the claim→completion crash window. The
// guarded claim makes a send at-most-once, so a process that dies while a row
// is `sending` leaves a row that no retry can deliver. This sweeper runs beside
// the delivery worker, finds rows whose claim is older than the threshold,
// returns them to a claimable state and requeues them.
//
// The reclaim is a new job id, not the deterministic one: the crashed attempt's
// job record is still in Redis (completed jobs are kept 7 days) and `queue.add`
// with an existing id is a silently ignored no-op. The claim guard admits the
// requeued job through the same transition as the original, so a reclaim racing
// a *job* loses at the claim and sends nothing.
//
// That guard is not what keeps a live send single, though (P9): a reclaim is
// triggered by the age of a claim, and the guard cannot tell a crashed claim
// from one whose provider call is merely slow. What does is the deadline the
// delivery service puts on every send (EMAIL_SEND_TIMEOUT_MS) together with the
// startup validation that refuses a threshold which does not clear it by a
// safety factor — the send is guaranteed to have ended, and to have recorded
// its outcome, before this sweeper may call its claim stale.
export const CLAIM_SWEEP_INTERVAL_MS = 60_000;
export const CLAIM_SWEEP_BATCH_SIZE = 100;

// P9: the reason left on a row that cannot be requeued, so the panel says what
// was lost instead of promising a retry.
export const UNRECLAIMABLE_REASON =
  'reclaim lost: the job record was evicted before the delivery could be requeued';

export type EmailClaimSweeper = {
  /** Starts the periodic pass; idempotent. */
  start(): void;
  /** One explicit pass — the test seam. Returns the rows it requeued. */
  sweepOnce(): Promise<number>;
  /** Stops the periodic pass and waits for one in flight; idempotent. */
  close(): Promise<void>;
};

export type EmailClaimSweeperDeps = {
  repository: EmailDeliveriesRepository;
  queue: Queue;
  /** How long a `sending` claim may sit before it is treated as crashed. */
  staleAfterMs: number;
  intervalMs?: number;
  batchSize?: number;
};

export function createEmailClaimSweeper(
  deps: EmailClaimSweeperDeps
): EmailClaimSweeper {
  const intervalMs = deps.intervalMs ?? CLAIM_SWEEP_INTERVAL_MS;
  const batchSize = deps.batchSize ?? CLAIM_SWEEP_BATCH_SIZE;

  let timer: NodeJS.Timeout | null = null;
  let inFlight: Promise<void> | null = null;

  const sweepOnce = async (): Promise<number> => {
    const stuck = await deps.repository.reclaimStaleSending({
      staleSeconds: deps.staleAfterMs / 1000,
      limit: batchSize,
    });

    let requeued = 0;

    for (const row of stuck) {
      // The job payload is not in the ledger, so the reclaim reuses the payload
      // the crashed attempt left behind in its retained job record.
      // shortcut: a row whose job record was evicted cannot be requeued — the
      // content is gone. It is closed as `failed` with the reason rather than
      // advertised as a pending `retried` retry; add payload columns to the
      // ledger if the delivery itself has to outlive the queue's retention.
      const job = await deps.queue.getJob(
        emailJobId(row.eventId, row.recipientAddress)
      );

      if (!job) {
        await deps.repository.failUnreclaimable({
          id: row.id,
          reason: UNRECLAIMABLE_REASON,
        });
        console.error(
          `[worker] claim sweep: no job record left for delivery ${row.id}; marked it failed`
        );
        continue;
      }

      await deps.queue.add(EMAIL_JOB_NAME, job.data as EmailDeliveryJob, {
        jobId: reclaimJobId(row.id, row.attemptCount),
      });
      requeued += 1;
    }

    return requeued;
  };

  const runOnce = (): Promise<void> => {
    if (inFlight) {
      return inFlight;
    }

    inFlight = sweepOnce()
      .then((requeued) => {
        if (requeued > 0) {
          console.warn(`[worker] claim sweep reclaimed ${requeued} delivery row(s)`);
        }
      })
      .catch((error) => {
        console.error('[worker] claim sweep failed', error);
      })
      .finally(() => {
        inFlight = null;
      });

    return inFlight;
  };

  return {
    start() {
      if (timer) {
        return;
      }

      timer = setInterval(() => void runOnce(), intervalMs);
      // The sweep must never be the reason the process stays alive.
      timer.unref();
    },
    sweepOnce,
    async close() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }

      await inFlight;
    },
  };
}
