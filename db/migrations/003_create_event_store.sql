-- migrate:up
CREATE TABLE IF NOT EXISTS event_store (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  event_id VARCHAR(36) NOT NULL UNIQUE,
  event_type VARCHAR(64) NOT NULL,
  aggregate_id VARCHAR(128) NOT NULL,
  aggregate_type VARCHAR(64) NOT NULL,
  payload JSON NOT NULL,
  version INT NOT NULL,
  occurred_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_aggregate_id (aggregate_id),
  INDEX idx_event_type (event_type),
  INDEX idx_occurred_at (occurred_at),
  UNIQUE INDEX idx_aggregate_version (aggregate_id, version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- migrate:down
DROP TABLE IF EXISTS event_store;
