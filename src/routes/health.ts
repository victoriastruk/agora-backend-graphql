import { Elysia } from 'elysia';
import {
  API_VERSION,
  API_MESSAGE,
  HEALTH_STATUS_OK,
  ROUTES,
} from '@/constants/app';

export const healthRoutes = new Elysia()
  .get(ROUTES.HEALTH, () => ({
    status: HEALTH_STATUS_OK,
    timestamp: new Date().toISOString(),
  }))
  .get(ROUTES.ROOT, () => ({
    message: API_MESSAGE,
    version: API_VERSION,
    docs: ROUTES.DOCS,
    graphql: ROUTES.GRAPHQL,
    health: ROUTES.HEALTH,
  }))
  .all(ROUTES.HEALTH, ({ request, set }) => {
    if (request.method === 'GET') {
      return; // Let the GET handler handle it
    }
    set.status = 405;
    return {
      success: false,
      error: 'Method Not Allowed',
      message: 'Only GET method is allowed for this endpoint',
    };
  })
  .all(ROUTES.ROOT, ({ request, set }) => {
    if (request.method === 'GET') {
      return; // Let the GET handler handle it
    }
    set.status = 405;
    return {
      success: false,
      error: 'Method Not Allowed',
      message: 'Only GET method is allowed for this endpoint',
    };
  });
