import { createHash } from 'node:crypto';
// Shared S1/S3 identity: a claim never moves silently between Brand Core versions.
export const claimId = (brandId, version, path) => createHash('sha256')
  .update(JSON.stringify([brandId, version, path])).digest('hex');
