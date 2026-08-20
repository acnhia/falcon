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
  ('phone', 3, 'PHONE', 1, 1);

-- Added to make the form match a real brokerage account-opening form's
-- fields (see account_opening_fields.md), folded into this same
-- screen/activity by deliberate scope decision - see context.md. This whole
-- file re-runs idempotently on every deploy, so `phone`'s required flag is
-- fixed up explicitly for databases seeded before this change.
UPDATE field_definition SET required = 1 WHERE field_key = 'phone';

INSERT OR IGNORE INTO field_definition (field_key, activity_number, data_type, required, schema_version) VALUES
  ('middleName', 3, 'STRING', 0, 1),
  ('suffix', 3, 'ENUM', 0, 1),
  ('residentialAddressLine1', 3, 'STRING', 1, 1),
  ('residentialAddressLine2', 3, 'STRING', 0, 1),
  ('residentialCity', 3, 'STRING', 1, 1),
  ('residentialState', 3, 'ENUM', 1, 1),
  ('residentialPostalCode', 3, 'STRING', 1, 1),
  ('hasMailingAddress', 3, 'BOOLEAN', 0, 1),
  ('mailingAddressLine1', 3, 'STRING', 0, 1),
  ('mailingAddressLine2', 3, 'STRING', 0, 1),
  ('mailingCity', 3, 'STRING', 0, 1),
  ('mailingState', 3, 'ENUM', 0, 1),
  ('mailingPostalCode', 3, 'STRING', 0, 1),
  ('maritalStatus', 3, 'ENUM', 1, 1),
  ('citizenship', 3, 'ENUM', 1, 1),
  ('isBrokerDealerAffiliated', 3, 'BOOLEAN', 1, 1),
  ('brokerDealerFirmName', 3, 'STRING', 0, 1),
  ('isControlPerson', 3, 'BOOLEAN', 1, 1),
  ('controlPersonCompany', 3, 'STRING', 0, 1),
  ('isPoliticallyExposedPerson', 3, 'BOOLEAN', 1, 1),
  ('hasOtherBrokerageAccounts', 3, 'BOOLEAN', 0, 1);

-- The reference brokerage's Section 2 (Employment & finances) and Section 4 (Additional
-- details) - completing the field set. Employer address is simplified to
-- one line, source of funds and account features are single-select /
-- individual booleans rather than multi-select (no array-value support in
-- this schema), and investment experience is one overall level rather than
-- The reference brokerage's per-product breakdown - documented scope reductions.
INSERT OR IGNORE INTO field_definition (field_key, activity_number, data_type, required, schema_version) VALUES
  ('employmentStatus', 3, 'ENUM', 1, 1),
  ('employerName', 3, 'STRING', 0, 1),
  ('occupation', 3, 'STRING', 0, 1),
  ('employerAddress', 3, 'STRING', 0, 1),
  ('yearsWithEmployer', 3, 'STRING', 0, 1),
  ('annualIncomeRange', 3, 'ENUM', 1, 1),
  ('netWorthRange', 3, 'ENUM', 1, 1),
  ('liquidNetWorthRange', 3, 'ENUM', 1, 1),
  ('taxBracketRange', 3, 'ENUM', 0, 1),
  ('sourceOfFunds', 3, 'ENUM', 1, 1),
  ('investmentObjective', 3, 'ENUM', 1, 1),
  ('riskTolerance', 3, 'ENUM', 1, 1),
  ('investmentExperience', 3, 'ENUM', 1, 1),
  ('timeHorizon', 3, 'ENUM', 1, 1),
  ('trustedContactName', 3, 'STRING', 0, 1),
  ('trustedContactPhone', 3, 'PHONE', 0, 1),
  ('trustedContactEmail', 3, 'EMAIL', 0, 1),
  ('trustedContactRelationship', 3, 'STRING', 0, 1),
  ('wantsMarginAccount', 3, 'BOOLEAN', 0, 1),
  ('wantsOptionsTrading', 3, 'BOOLEAN', 0, 1),
  ('wantsDividendReinvestment', 3, 'BOOLEAN', 0, 1),
  ('deliveryPreference', 3, 'ENUM', 1, 1),
  ('costBasisMethod', 3, 'ENUM', 0, 1),
  ('w9Certification', 3, 'BOOLEAN', 1, 1),
  ('esignatureConsent', 3, 'BOOLEAN', 1, 1);

-- Access log for the site-wide login gate. Not onboarding data, but it shares this database
-- rather than provisioning a third one for a single table. Ownership lives in the code
-- (backend/edge-worker/src/auth/loginEventRepository.ts), which is the boundary that matters.
--
-- Records every login attempt, successful or not, so "how many people reviewed this, and when"
-- is answerable. With a single shared admin credential, visitors are distinguished by IP,
-- approximate location and user agent rather than by identity.
CREATE TABLE IF NOT EXISTS auth_login_event (
  id TEXT PRIMARY KEY,
  occurred_at TEXT NOT NULL,
  outcome TEXT NOT NULL,          -- SUCCESS | BAD_CREDENTIALS | FAILED_CAPTCHA
  ip_address TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  timezone TEXT,
  network TEXT,                   -- ASN organisation, e.g. the ISP or corporate network
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_auth_login_event_occurred_at ON auth_login_event (occurred_at);
CREATE INDEX IF NOT EXISTS idx_auth_login_event_ip ON auth_login_event (ip_address);
