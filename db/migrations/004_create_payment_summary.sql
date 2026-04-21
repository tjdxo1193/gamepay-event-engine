-- migrate:up
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

-- migrate:down
DROP TABLE IF EXISTS payment_summary;
