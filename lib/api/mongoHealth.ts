'use client';
import { mongoSummarySchema, mongoCollectionsSchema, mongoIndexesSchema } from '@/lib/mongo-health';
import type { z } from 'zod';

async function read<T>(path: string, schema: z.ZodType<T>, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/mongo-health/${path}`, { credentials: 'same-origin', cache: 'no-store', signal });
  if (!response.ok) throw new Error(response.status === 401 ? 'Your session expired. Sign in again.' : 'Mongo Health could not be read. Try again shortly.');
  const envelope = await response.json();
  if (envelope.ok !== true) throw new Error('Mongo Health returned an incomplete response.');
  return schema.parse(envelope.data);
}
export const mongoHealthKeys = {
  all: ['systems', 'mongo-health'] as const,
  summary: ['systems', 'mongo-health', 'summary'] as const,
  collections: ['systems', 'mongo-health', 'collections'] as const,
  indexes: (name: string) => ['systems', 'mongo-health', 'indexes', name] as const,
};
export const fetchMongoSummary = (signal?: AbortSignal) => read('summary', mongoSummarySchema, signal);
export const fetchMongoCollections = (signal?: AbortSignal) => read('collections', mongoCollectionsSchema, signal);
export const fetchMongoIndexes = (name: string, signal?: AbortSignal) => read(`collections/${encodeURIComponent(name)}/indexes`, mongoIndexesSchema, signal);
