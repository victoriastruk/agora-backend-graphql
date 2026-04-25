import { mergeResolvers } from "@graphql-tools/merge";
import { userResolvers } from "./user";
import { communityResolvers } from "./community";
import { postResolvers } from "./post";
import { commentResolvers } from "./comment";
import { voteResolvers } from "./vote";
import { flairResolvers } from "./flair";
import { reportResolvers } from "./report";
import { subscriptionResolvers } from "./subscription";

export const resolvers = mergeResolvers([
  userResolvers,
  communityResolvers,
  postResolvers,
  commentResolvers,
  voteResolvers,
  flairResolvers,
  reportResolvers,
  subscriptionResolvers,
]);