CREATE TABLE IF NOT EXISTS pb_challenges (
 id text PRIMARY KEY, account_id text NOT NULL, nonce text NOT NULL, message text NOT NULL,
 recipient text NOT NULL, expires_at timestamptz NOT NULL, used_at timestamptz
);
CREATE TABLE IF NOT EXISTS pb_sessions (
 token_hash text PRIMARY KEY, account_id text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS pb_jobs (
 order_id text PRIMARY KEY, token_id text UNIQUE NOT NULL, buyer_id text NOT NULL, revision integer NOT NULL,
 state text NOT NULL DEFAULT 'queued', input_cipher text NOT NULL, result_cipher text,
 request_commitment text, error_code text, lease_until timestamptz, provider_attempted_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pb_jobs_queue ON pb_jobs(state,created_at);
CREATE TABLE IF NOT EXISTS pb_chain_observations (
 id bigserial PRIMARY KEY, order_id text, token_id text, action text NOT NULL,
 tx_hash text NOT NULL, signer_id text NOT NULL, outcome jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
