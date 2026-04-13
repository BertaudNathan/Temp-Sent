CREATE TABLE IF NOT EXISTS telemetry_archive (
  rtdb_key VARCHAR(64) NOT NULL,
  timestamp_server BIGINT NULL,
  timestamp_device BIGINT NULL,
  device_id VARCHAR(64) NULL,
  topic VARCHAR(128) NULL,
  temperature DOUBLE NULL,
  humidity DOUBLE NULL,
  payload_json LONGTEXT NOT NULL,
  archived_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (rtdb_key),
  INDEX idx_ts_server (timestamp_server),
  INDEX idx_device (device_id)
);

CREATE TABLE IF NOT EXISTS hardware_archive (
  rtdb_key VARCHAR(64) NOT NULL,
  timestamp_server BIGINT NULL,
  timestamp_device BIGINT NULL,
  device_id VARCHAR(64) NULL,
  topic VARCHAR(128) NULL,
  kpi_type VARCHAR(64) NULL,
  payload_json LONGTEXT NOT NULL,
  archived_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (rtdb_key),
  INDEX idx_ts_server (timestamp_server),
  INDEX idx_device (device_id),
  INDEX idx_kpi (kpi_type)
);
