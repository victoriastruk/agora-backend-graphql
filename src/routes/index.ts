import { usersRoutes } from './users';
import { communitiesRoutes } from './communities';
import { postsRoutes } from './posts';
import { feedRoutes, topStoriesRoutes } from './feed';
import { commentsRoutes } from './comments';

/**
 * Central export for all API routes
 *
 * ⚠️ DEPRECATED: Ці REST endpoints застарілі.
 * Використовуйте GraphQL API замість них (окрім auth endpoints).
 *
 * GraphQL endpoint: /graphql
 * Документація: GRAPHQL_API.md
 */
export const routes = [
  usersRoutes,
  communitiesRoutes,
  postsRoutes,
  feedRoutes,
  topStoriesRoutes,
  commentsRoutes,
];
