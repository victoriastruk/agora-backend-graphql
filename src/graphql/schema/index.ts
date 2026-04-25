import { makeExecutableSchema } from "@graphql-tools/schema";
import { mergeTypeDefs } from "@graphql-tools/merge";
import { resolvers } from "../resolvers/";

import { userTypeDefs } from "./user";
import { communityTypeDefs } from "./community";
import { postTypeDefs } from "./post";
import { commentTypeDefs } from "./comment";
import { voteTypeDefs } from "./vote";
import { flairTypeDefs } from "./flair";
import { reportTypeDefs } from "./report";
import { subscriptionTypeDefs } from "./subscription";

const baseTypeDefs = `
  scalar DateTime

  enum SortType { best hot new rising top }
  enum VoteType { upvote downvote }
  enum Region { all north_america europe asia australia south_america africa }

  type Query
  type Mutation
  type Subscription
`;

export const schema = makeExecutableSchema({
  typeDefs: mergeTypeDefs([
    baseTypeDefs,
    userTypeDefs,
    communityTypeDefs,
    postTypeDefs,
    commentTypeDefs,
    voteTypeDefs,
    flairTypeDefs,
    reportTypeDefs,
    subscriptionTypeDefs,
  ]),
  resolvers,
});