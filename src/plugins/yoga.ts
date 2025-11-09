import { yoga } from '@elysiajs/graphql-yoga';
import { schema } from '@/graphql/schema';
import { pubsub } from '@/graphql/resolvers';
import { AuthUtils } from '@/utils/auth';

export const yogaPlugin = yoga({
  schema,
  graphiql: {
    title: 'Reddit Backend GraphQL API',
    defaultQuery: `# Welcome to Reddit Backend GraphQL API
# 
# This playground provides access to all GraphQL queries, mutations, and subscriptions.
# 
# Authentication: Include your JWT token in the headers:
# {
#   "Authorization": "Bearer YOUR_ACCESS_TOKEN"
# }
#
# Example Query:
query GetFeed {
  feed(sort: hot, limit: 10) {
    id
    title
    score
    commentCount
    community {
      name
      displayName
      iconUrl
    }
    author {
      username
    }
    flairs {
      label
      color
    }
  }
}

# Example Mutation:
# mutation CreatePost {
#   createPost(input: {
#     communityId: "1"
#     title: "My awesome post"
#     content: "This is the content"
#     type: text
#   }) {
#     id
#     title
#     score
#   }
# }
`,
  },
  context: async ({ request }) => {
    let userId: number | undefined = undefined;

    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const accessVerification = await AuthUtils.verifyAccessToken(token);
      if (accessVerification.status === 'valid' && accessVerification.payload) {
        userId = Number(accessVerification.payload.sub);
      }
    }

    const cookieHeader = request.headers.get('cookie');
    if (!userId && cookieHeader) {
      const cookies = Object.fromEntries(
        cookieHeader.split('; ').map((c) => {
          const [key, value] = c.split('=');
          return [key, value];
        })
      );

      if (cookies.accessToken) {
        const accessVerification = await AuthUtils.verifyAccessToken(
          cookies.accessToken
        );
        if (
          accessVerification.status === 'valid' &&
          accessVerification.payload
        ) {
          userId = Number(accessVerification.payload.sub);
        }
      }
    }

    return {
      userId,
      pubsub,
    };
  },
});
