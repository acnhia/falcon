CREATE TABLE IF NOT EXISTS onboarding_application (
  id TEXT PRIMARY KEY,
  public_reference TEXT NOT NULL UNIQUE,
  overall_status TEXT NOT NULL,
  validation_triggered INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS onboarding_activity (
  application_id TEXT NOT NULL,
  activity_number INTEGER NOT NULL,
  status TEXT NOT NULL,
  blocked_reason_code TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (application_id, activity_number)
);

CREATE TABLE IF NOT EXISTS field_definition (
  field_key TEXT PRIMARY KEY,
  activity_number INTEGER NOT NULL,
  data_type TEXT NOT NULL,
  required INTEGER NOT NULL,
  schema_version INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS application_field_value (
  application_id TEXT NOT NULL,
  field_key TEXT NOT NULL,
  value TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (application_id, field_key)
);

CREATE TABLE IF NOT EXISTS identity_capture_session (
  token_hash TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS identity_document (
  application_id TEXT NOT NULL,
  side TEXT NOT NULL,
  object_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  checksum TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  PRIMARY KEY (application_id, side)
);

CREATE TABLE IF NOT EXISTS provider_check (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  check_type TEXT NOT NULL,
  provider_mode TEXT NOT NULL,
  status TEXT NOT NULL,
  result_code TEXT,
  correlation_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workflow_operation (
  application_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  status TEXT NOT NULL,
  error_code TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (application_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS application_audit_event (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  activity_number INTEGER,
  actor TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  metadata TEXT
);

INSERT OR IGNORE INTO field_definition (field_key, activity_number, data_type, required, schema_version) VALUES
  ('legalFirstName', 3, 'STRING', 1, 1),
  ('legalLastName', 3, 'STRING', 1, 1),
  ('dateOfBirth', 3, 'DATE', 1, 1),
  ('email', 3, 'EMAIL', 1, 1),
  ('residentialCountry', 3, 'COUNTRY', 1, 1),
  ('preferredFirstName', 3, 'STRING', 0, 1),
  ('preferredLastName', 3, 'STRING', 0, 1),
  ('phone', 3, 'PHONE', 0, 1);
