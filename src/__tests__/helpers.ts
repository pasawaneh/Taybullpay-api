import { v4 as uuidv4 } from 'uuid';

export const authHeaders = {
  'x-api-key': 'test-key',
  'x-api-secret': 'test-secret',
};

export function idempotencyKey(): string {
  return uuidv4();
}
