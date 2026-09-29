-- Add provenance fields to ingestion records so every imported item can carry
-- its source URL, retrieval timestamp, verification state and confidence.
alter table public.ingestion_queue
  add column if not exists source_url text,
  add column if not exists published_at timestamptz,
  add column if not exists retrieved_at timestamptz,
  add column if not exists verification_status text,
  add column if not exists confidence_score integer,
  add column if not exists raw_payload jsonb,
  add column if not exists normalised_payload jsonb;

-- Keep verification values constrained for review and downstream filtering.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ingestion_queue_verification_status_check'
  ) THEN
    ALTER TABLE public.ingestion_queue
      ADD CONSTRAINT ingestion_queue_verification_status_check
      CHECK (
        verification_status IS NULL OR verification_status IN (
          'unverified',
          'needs_review',
          'verified',
          'rejected'
        )
      );
  END IF;
END $$;

-- Confidence is stored as a 0-100 score to support both UI and admin review.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ingestion_queue_confidence_score_check'
  ) THEN
    ALTER TABLE public.ingestion_queue
      ADD CONSTRAINT ingestion_queue_confidence_score_check
      CHECK (
        confidence_score IS NULL OR (
          confidence_score >= 0 AND confidence_score <= 100
        )
      );
  END IF;
END $$;

create index if not exists ingestion_queue_verification_status_idx
  on public.ingestion_queue (verification_status);

create index if not exists ingestion_queue_confidence_score_idx
  on public.ingestion_queue (confidence_score);

create index if not exists ingestion_queue_retrieved_at_idx
  on public.ingestion_queue (retrieved_at);
