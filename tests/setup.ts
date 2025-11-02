import { beforeAll, afterAll, vi } from 'vitest';
import { testLifecycle } from './utils/test-helpers';

beforeAll(testLifecycle.beforeAll);
afterAll(testLifecycle.afterAll);

process.env.NODE_ENV = 'test';
