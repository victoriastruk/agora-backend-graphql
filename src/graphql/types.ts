import type { PubSub } from "graphql-subscriptions";

export type GraphQLContext = {
  userId?: number;
  pubsub: PubSub;
};