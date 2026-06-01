import dns from "node:dns";
import mongoose, { type ConnectOptions } from "mongoose";
import { getServerEnv } from "@/lib/env/server";

interface AdminMongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

const MAX_CONNECT_ATTEMPTS = 2;

declare global {
  var __adminMongooseCache: AdminMongooseCache | undefined;
}

function getCache(): AdminMongooseCache {
  if (!global.__adminMongooseCache) {
    global.__adminMongooseCache = { conn: null, promise: null };
  }
  return global.__adminMongooseCache;
}

export async function connectAdminMongo(): Promise<void> {
  const env = getServerEnv();
  const cache = getCache();

  if (cache.conn && mongoose.connection.readyState === 1) {
    return;
  }

  if (!cache.promise) {
    configureMongoDnsServers();
    cache.promise = connectWithRetry(env.MONGODB_URI, {
      dbName: env.ADMIN_AUTH_DB_NAME,
      maxPoolSize: 5,
      minPoolSize: 0,
      maxIdleTimeMS: 60_000,
      serverSelectionTimeoutMS: 5_000,
      socketTimeoutMS: 45_000,
    }).catch((error) => {
      cache.promise = null;
      throw error;
    });
  }

  await cache.promise;
  cache.conn = mongoose;
}

async function connectWithRetry(
  uri: string,
  options: ConnectOptions,
): Promise<typeof mongoose> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_CONNECT_ATTEMPTS; attempt += 1) {
    try {
      return await mongoose.connect(uri, options);
    } catch (error) {
      lastError = error;
      if (attempt === MAX_CONNECT_ATTEMPTS || !isTransientConnectionError(error)) {
        break;
      }
      await delay(250 * attempt);
    }
  }

  throw lastError;
}

function isTransientConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  if (
    error.name === "MongooseServerSelectionError" ||
    error.name === "MongoServerSelectionError" ||
    error.name === "MongoNetworkError" ||
    error.name === "MongoNetworkTimeoutError"
  ) {
    return true;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("ssl") ||
    message.includes("tls") ||
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("etimedout") ||
    message.includes("server selection")
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let loggedDnsConfiguration = false;

function configureMongoDnsServers(): void {
  if (process.env.VERCEL === "1" || process.env.NODE_ENV === "production") {
    return;
  }

  const servers = process.env.MONGO_DNS_SERVERS?.split(",")
    .map((server) => server.trim())
    .filter(Boolean);

  if (!servers?.length) {
    return;
  }

  dns.setServers(servers);
  if (!loggedDnsConfiguration) {
    loggedDnsConfiguration = true;
    console.info("mongo.dns.servers_configured", servers);
  }
}
