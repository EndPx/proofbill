-- Upgrade the initial four-table bootstrap without deleting data.
CREATE TABLE IF NOT EXISTS pb_accounts (
 account_id text PRIMARY KEY,
 network text NOT NULL DEFAULT 'testnet' CHECK (network='testnet'),
 created_at timestamptz NOT NULL DEFAULT now(), last_verified_at timestamptz
);
INSERT INTO pb_accounts(account_id)
 SELECT account_id FROM pb_challenges UNION SELECT account_id FROM pb_sessions
 UNION SELECT buyer_id FROM pb_jobs UNION SELECT signer_id FROM pb_chain_observations
 ON CONFLICT DO NOTHING;
ALTER TABLE pb_jobs ADD COLUMN IF NOT EXISTS job_id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE pb_jobs ADD COLUMN IF NOT EXISTS network text NOT NULL DEFAULT 'testnet';
ALTER TABLE pb_jobs ADD COLUMN IF NOT EXISTS contract_id text;
UPDATE pb_jobs SET contract_id=NULLIF(current_setting('proofbill.contract_id',true),'') WHERE contract_id IS NULL;
ALTER TABLE pb_jobs ALTER COLUMN contract_id SET NOT NULL;
ALTER TABLE pb_jobs ADD COLUMN IF NOT EXISTS agent_id text;
ALTER TABLE pb_jobs ADD COLUMN IF NOT EXISTS lease_token uuid;
ALTER TABLE pb_jobs ADD COLUMN IF NOT EXISTS erased_at timestamptz;
ALTER TABLE pb_jobs ADD COLUMN IF NOT EXISTS terminal_at timestamptz;
ALTER TABLE pb_jobs ADD COLUMN IF NOT EXISTS retention_checked_at timestamptz;
ALTER TABLE pb_jobs ALTER COLUMN input_cipher DROP NOT NULL;
ALTER TABLE pb_sessions ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE pb_chain_observations ADD COLUMN IF NOT EXISTS network text NOT NULL DEFAULT 'testnet';
ALTER TABLE pb_chain_observations ADD COLUMN IF NOT EXISTS contract_id text;
UPDATE pb_chain_observations SET contract_id=NULLIF(current_setting('proofbill.contract_id',true),'') WHERE contract_id IS NULL;
ALTER TABLE pb_chain_observations ALTER COLUMN contract_id SET NOT NULL;
ALTER TABLE pb_chain_observations ADD COLUMN IF NOT EXISTS job_id uuid;
UPDATE pb_chain_observations o SET job_id=j.job_id FROM pb_jobs j
 WHERE o.job_id IS NULL AND o.network=j.network AND o.contract_id=j.contract_id AND o.order_id=j.order_id;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pb_jobs_pkey' AND conrelid='pb_jobs'::regclass AND pg_get_constraintdef(oid)='PRIMARY KEY (order_id)') THEN
  ALTER TABLE pb_jobs DROP CONSTRAINT pb_jobs_pkey;
  ALTER TABLE pb_jobs ADD PRIMARY KEY(job_id);
 END IF;
 ALTER TABLE pb_jobs DROP CONSTRAINT IF EXISTS pb_jobs_token_id_key;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pb_challenges_account_fk') THEN
  ALTER TABLE pb_challenges ADD CONSTRAINT pb_challenges_account_fk FOREIGN KEY(account_id) REFERENCES pb_accounts(account_id) ON DELETE RESTRICT;
  ALTER TABLE pb_sessions ADD CONSTRAINT pb_sessions_account_fk FOREIGN KEY(account_id) REFERENCES pb_accounts(account_id) ON DELETE RESTRICT;
  ALTER TABLE pb_jobs ADD CONSTRAINT pb_jobs_buyer_fk FOREIGN KEY(buyer_id) REFERENCES pb_accounts(account_id) ON DELETE RESTRICT;
  ALTER TABLE pb_chain_observations ADD CONSTRAINT pb_observations_signer_fk FOREIGN KEY(signer_id) REFERENCES pb_accounts(account_id) ON DELETE RESTRICT;
  ALTER TABLE pb_chain_observations ADD CONSTRAINT pb_observations_job_fk FOREIGN KEY(job_id) REFERENCES pb_jobs(job_id) ON DELETE RESTRICT;
  ALTER TABLE pb_jobs ADD CONSTRAINT pb_jobs_revision_nonnegative CHECK(revision>=0);
  ALTER TABLE pb_jobs ADD CONSTRAINT pb_jobs_network_testnet CHECK(network='testnet');
  ALTER TABLE pb_jobs ADD CONSTRAINT pb_jobs_worker_state CHECK(state IN ('queued','claimed','reserving','running','publishing','delivered','failed','reconciliation_required','erased'));
  ALTER TABLE pb_jobs ADD CONSTRAINT pb_jobs_erasure_consistent CHECK(erased_at IS NULL OR (input_cipher IS NULL AND result_cipher IS NULL AND state='erased'));
 END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS pb_jobs_chain_identity ON pb_jobs(network,contract_id,order_id);
DROP INDEX IF EXISTS pb_jobs_single_use_pass;
CREATE INDEX IF NOT EXISTS pb_jobs_pass_history ON pb_jobs(network,contract_id,token_id,created_at);
CREATE UNIQUE INDEX IF NOT EXISTS pb_observations_transaction ON pb_chain_observations(network,tx_hash);
CREATE UNIQUE INDEX IF NOT EXISTS pb_challenges_nonce ON pb_challenges(nonce);
CREATE INDEX IF NOT EXISTS pb_challenges_expiry ON pb_challenges(expires_at);
CREATE INDEX IF NOT EXISTS pb_sessions_expiry ON pb_sessions(expires_at);
CREATE INDEX IF NOT EXISTS pb_sessions_account ON pb_sessions(account_id);
CREATE INDEX IF NOT EXISTS pb_jobs_buyer_created ON pb_jobs(buyer_id,created_at);
CREATE INDEX IF NOT EXISTS pb_jobs_retention_scan ON pb_jobs(contract_id,(coalesce(retention_checked_at,created_at)),job_id)
 WHERE terminal_at IS NULL AND erased_at IS NULL AND state IN ('awaiting_reservation','delivered','failed','reconciliation_required');
CREATE INDEX IF NOT EXISTS pb_observations_job ON pb_chain_observations(job_id);
CREATE INDEX IF NOT EXISTS pb_observations_token ON pb_chain_observations(contract_id,token_id);

ALTER TABLE pb_jobs DROP CONSTRAINT IF EXISTS pb_jobs_worker_state;
ALTER TABLE pb_jobs ADD CONSTRAINT pb_jobs_worker_state CHECK(state IN ('awaiting_reservation','queued','claimed','reserving','running','publishing','delivered','failed','reconciliation_required','erased'));
