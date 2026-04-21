-- Combined init script for Docker (runs all migrations in order)
-- In production, use dbmate for proper migration management

CREATE DATABASE IF NOT EXISTS gamepay;
USE gamepay;

-- 001: payments
CREATE TABLE IF NOT EXISTS payments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_number VARCHAR(64) NOT NULL UNIQUE,
  user_id VARCHAR(64) NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'KRW',
  status ENUM('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  transaction_id VARCHAR(128) NULL,
  paid_at DATETIME NULL,
  refunded_at DATETIME NULL,
  refund_amount DECIMAL(12, 2) NULL,
  refund_reason TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 002: subscriptions
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

-- 003: event_store
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

-- 004: payment_summary (CQRS read model)
CREATE TABLE IF NOT EXISTS payment_summary (
  date DATE PRIMARY KEY,
  total_revenue DECIMAL(15, 2) NOT NULL DEFAULT 0,
  total_transactions INT NOT NULL DEFAULT 0,
  successful_transactions INT NOT NULL DEFAULT 0,
  failed_transactions INT NOT NULL DEFAULT 0,
  total_refunds DECIMAL(15, 2) NOT NULL DEFAULT 0,
  refund_count INT NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
