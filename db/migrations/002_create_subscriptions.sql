-- migrate:up
CREATE TABLE IF NOT EXISTS subscriptions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  subscription_id VARCHAR(64) NOT NULL UNIQUE,
  user_id VARCHAR(64) NOT NULL,
  plan_id VARCHAR(64) NOT NULL,
  plan ENUM('MONTHLY', 'ANNUAL') NOT NULL,
  status ENUM('ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING_RENEWAL') NOT NULL DEFAULT 'ACTIVE',
  start_date DATETIME NOT NULL,
  end_date DATETIME NOT NULL,
  cancelled_at DATETIME NULL,
  cancel_reason TEXT NULL,
  auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_end_date (end_date),
  INDEX idx_status_autorenew_enddate (status, auto_renew, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- migrate:down
DROP TABLE IF EXISTS subscriptions;
