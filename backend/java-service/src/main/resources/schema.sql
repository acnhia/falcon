CREATE TABLE IF NOT EXISTS onboarding_application (
  id VARCHAR(64) PRIMARY KEY,
  public_reference VARCHAR(64) NOT NULL UNIQUE,
  overall_status VARCHAR(32) NOT NULL,
  validation_triggered BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS onboarding_activity (
  application_id VARCHAR(64) NOT NULL,
  activity_number INTEGER NOT NULL,
  status VARCHAR(32) NOT NULL,
  blocked_reason_code VARCHAR(64),
  updated_at TIMESTAMP NOT NULL,
  PRIMARY KEY (application_id, activity_number)
);

CREATE TABLE IF NOT EXISTS field_definition (
  field_key VARCHAR(64) PRIMARY KEY,
  activity_number INTEGER NOT NULL,
  data_type VARCHAR(32) NOT NULL,
  required BOOLEAN NOT NULL,
  schema_version INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS application_field_value (
  application_id VARCHAR(64) NOT NULL,
  field_key VARCHAR(64) NOT NULL,
  "value" VARCHAR(1024),
  updated_at TIMESTAMP NOT NULL,
  PRIMARY KEY (application_id, field_key)
);

CREATE TABLE IF NOT EXISTS identity_capture_session (
  token_hash VARCHAR(128) PRIMARY KEY,
  application_id VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  consumed BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS identity_document (
  application_id VARCHAR(64) NOT NULL,
  side VARCHAR(16) NOT NULL,
  object_key VARCHAR(512) NOT NULL,
  mime_type VARCHAR(128) NOT NULL,
  byte_size BIGINT NOT NULL,
  checksum VARCHAR(128) NOT NULL,
  captured_at TIMESTAMP NOT NULL,
  PRIMARY KEY (application_id, side)
);

CREATE TABLE IF NOT EXISTS provider_check (
  id VARCHAR(64) PRIMARY KEY,
  application_id VARCHAR(64) NOT NULL,
  check_type VARCHAR(64) NOT NULL,
  provider_mode VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL,
  result_code VARCHAR(64),
  correlation_id VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS workflow_operation (
  application_id VARCHAR(64) NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  operation_type VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  error_code VARCHAR(64),
  created_at TIMESTAMP NOT NULL,
  PRIMARY KEY (application_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS application_audit_event (
  id VARCHAR(64) PRIMARY KEY,
  application_id VARCHAR(64) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  activity_number INTEGER,
  actor VARCHAR(32) NOT NULL,
  correlation_id VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  metadata VARCHAR(512)
);
