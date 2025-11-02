import { yoga } from '@elysiajs/graphql-yoga';
import { schema } from '@/graphql/schema';

export const yogaPlugin = yoga({
  schema,
  graphiql: true,
});
