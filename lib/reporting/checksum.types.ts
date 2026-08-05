export type ChecksumEnvelope<T> = {
  checksum_version: number;
  artifact_kind: string;
  schema_version: number;
  payload: T;
};
