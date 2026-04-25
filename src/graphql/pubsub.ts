import { PubSub } from "graphql-subscriptions";

export const pubsub = new PubSub();

export const Events = {
  POST_ADDED: "POST_ADDED",
  POST_UPDATED: "POST_UPDATED",
  POST_VOTED: "POST_VOTED",
  COMMENT_ADDED: "COMMENT_ADDED",
  COMMENT_VOTED: "COMMENT_VOTED",
} as const;