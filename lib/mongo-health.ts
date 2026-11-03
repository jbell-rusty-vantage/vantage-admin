import { z } from 'zod';

const metric = z.number().finite().nonnegative().nullable();
const reading = <T extends z.ZodType>(value: T) => z.discriminatedUnion('status', [
  z.object({ status: z.literal('available'), value }),
  z.object({ status: z.literal('unavailable'), reason: z.string() }),
]);
const sample = { sampledAt: z.iso.datetime(), cacheSeconds: z.number() };
export const mongoSummarySchema = z.object({
  ...sample, database: z.string(), startedAt: z.iso.datetime(), scope: z.string(),
  ping: reading(z.object({ milliseconds: metric })),
  storage: reading(z.object({ collections: metric, documents: metric, logicalBytes: metric, storageBytes: metric,
    indexBytes: metric, indexes: metric, diskUsedBytes: metric, diskTotalBytes: metric })),
  server: reading(z.object({ version: z.string(), uptimeSeconds: metric, residentMemoryMiB: metric, cacheBytes: metric,
    cacheLimitBytes: metric, connections: z.object({ current: metric, available: metric, active: metric, rejectedSinceStart: metric }) })),
  replica: reading(z.object({ members: z.array(z.object({ member: z.number(), state: z.string(), healthy: z.boolean(), lagSeconds: metric })) })),
});
const latency = z.object({ operations: z.number(), averageMs: metric }).nullable();
export const mongoCollectionsSchema = z.object({
  ...sample, database: z.string(), startedAt: z.iso.datetime(), total: z.number(), available: z.number(),
  collections: z.array(z.object({ name: z.string(), type: z.string(), storage: reading(z.object({
    documents: metric, logicalBytes: metric, storageBytes: metric, indexBytes: metric, reusableBytes: metric, indexCount: metric,
    reads: latency, writes: latency, collectionScansSinceStart: metric,
  })) })),
});
export const mongoIndexesSchema = z.object({
  ...sample, name: z.string(),
  definitions: reading(z.array(z.object({ name: z.string(), keys: z.record(z.string(), z.union([z.number(), z.string()])),
    unique: z.boolean(), hidden: z.boolean(), ttlSeconds: metric, partial: z.boolean(), sparse: z.boolean() }))),
  usage: reading(z.array(z.object({ name: z.string(), operations: metric, since: z.iso.datetime().nullable() }))),
  sizes: reading(z.array(z.record(z.string(), z.number()))),
});
export type MongoSummary = z.infer<typeof mongoSummarySchema>;
export type MongoCollections = z.infer<typeof mongoCollectionsSchema>;
export type MongoIndexes = z.infer<typeof mongoIndexesSchema>;
export type MongoCollection = MongoCollections['collections'][number];

export function healthTarget(parts: string[], query: string) {
  if (query) throw new Error('Query parameters are not supported.');
  const path = parts.join('/');
  if (path !== 'summary' && path !== 'collections' && !/^collections\/[A-Za-z0-9_.-]{1,120}\/indexes$/.test(path)) {
    throw new Error('Invalid health route.');
  }
  return `/api/v1/mongo-health/${path}`;
}
export function parseHealthData(target: string, data: unknown) {
  return target.endsWith('/summary') ? mongoSummarySchema.parse(data)
    : target.endsWith('/indexes') ? mongoIndexesSchema.parse(data) : mongoCollectionsSchema.parse(data);
}
