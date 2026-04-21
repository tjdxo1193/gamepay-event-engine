import 'reflect-metadata';
import { MySqlContainer, StartedMySqlContainer } from '@testcontainers/mysql';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import mysql from 'mysql2/promise';
import { container } from 'tsyringe';
import { DatabaseConnectionPool } from '../../src/config/database';
import { RedisClient } from '../../src/config/redis';
import Redis from 'ioredis';
import fs from 'fs';
import path from 'path';

let mysqlContainer: StartedMySqlContainer;
let redisContainer: StartedTestContainer;

export async function setupTestInfra(): Promise<{
  dbHost: string;
  dbPort: number;
  redisHost: string;
  redisPort: number;
}> {
  // Start MySQL container
  mysqlContainer = await new MySqlContainer('mysql:8.0')
    .withDatabase('gamepay')
    .withUsername('gamepay')
    .withUserPassword('gamepay_secret')
    .start();

  // Start Redis container
  redisContainer = await new GenericContainer('redis:7-alpine')
    .withExposedPorts(6379)
    .start();

  // Run migrations
  const connection = await mysql.createConnection({
    host: mysqlContainer.getHost(),
    port: mysqlContainer.getPort(),
    user: 'gamepay',
    password: 'gamepay_secret',
    database: 'gamepay',
    multipleStatements: true,
  });

  const initSql = fs.readFileSync(path.join(__dirname, '../../db/init.sql'), 'utf-8');
  await connection.query(initSql);
  await connection.end();

  // Override env for DI
  process.env.DB_HOST = mysqlContainer.getHost();
  process.env.DB_PORT = String(mysqlContainer.getPort());
  process.env.DB_USER = 'gamepay';
  process.env.DB_PASSWORD = 'gamepay_secret';
  process.env.DB_NAME = 'gamepay';
  process.env.REDIS_HOST = redisContainer.getHost();
  process.env.REDIS_PORT = String(redisContainer.getMappedPort(6379));

  return {
    dbHost: mysqlContainer.getHost(),
    dbPort: mysqlContainer.getPort(),
    redisHost: redisContainer.getHost(),
    redisPort: redisContainer.getMappedPort(6379),
  };
}

export function setupDIContainer(config: {
  dbHost: string;
  dbPort: number;
  redisHost: string;
  redisPort: number;
}): void {
  // Reset container for clean state
  container.clearInstances();

  // Register with test config by overriding env before singletons init
  process.env.DB_HOST = config.dbHost;
  process.env.DB_PORT = String(config.dbPort);
  process.env.REDIS_HOST = config.redisHost;
  process.env.REDIS_PORT = String(config.redisPort);

  // Force re-import to pick up new env
  const { setupContainer } = require('../../src/config/container');
  setupContainer();
}

export async function teardownTestInfra(): Promise<void> {
  // Close DI instances
  try {
    const db = container.resolve(DatabaseConnectionPool);
    await db.close();
  } catch { /* ignore */ }

  try {
    const redis = container.resolve(RedisClient);
    await redis.close();
  } catch { /* ignore */ }

  container.clearInstances();

  // Stop containers
  if (mysqlContainer) await mysqlContainer.stop();
  if (redisContainer) await redisContainer.stop();
}

export async function cleanTables(): Promise<void> {
  const db = container.resolve(DatabaseConnectionPool);
  await db.execute('DELETE FROM payment_summary' as any);
  await db.execute('DELETE FROM event_store' as any);
  await db.execute('DELETE FROM subscriptions' as any);
  await db.execute('DELETE FROM payments' as any);
}
