import { withFilter } from "graphql-subscriptions";
import { pubsub, Events } from "../pubsub";

export const subscriptionResolvers = {
  Subscription: {
    postAdded: {
      subscribe: withFilter(
        () => pubsub.asyncIterableIterator(Events.POST_ADDED),
        (
          payload: { postAdded: { community: { id: number } } } | undefined,
          variables: { communityId?: string } | undefined
        ) => {
          if (!payload) return false;
          if (!variables?.communityId) return true;
          return payload.postAdded.community.id === parseInt(variables.communityId);
        }
      ),
    },
    postUpdated: {
      subscribe: withFilter(
        () => pubsub.asyncIterableIterator(Events.POST_UPDATED),
        (
          payload: { postUpdated: { id: number } } | undefined,
          variables: { postId: string } | undefined
        ) => {
          if (!payload || !variables) return false;
          return payload.postUpdated.id === parseInt(variables.postId);
        }
      ),
    },
    postVoted: {
      subscribe: withFilter(
        () => pubsub.asyncIterableIterator(Events.POST_VOTED),
        (
          payload: { postVoted: { id: number } } | undefined,
          variables: { postId: string } | undefined
        ) => {
          if (!payload || !variables) return false;
          return payload.postVoted.id === parseInt(variables.postId);
        }
      ),
    },
    commentAdded: {
      subscribe: withFilter(
        () => pubsub.asyncIterableIterator(Events.COMMENT_ADDED),
        (
          payload: { commentAdded: { postId: number } } | undefined,
          variables: { postId: string } | undefined
        ) => {
          if (!payload || !variables) return false;
          return payload.commentAdded.postId === parseInt(variables.postId);
        }
      ),
    },
    commentVoted: {
      subscribe: withFilter(
        () => pubsub.asyncIterableIterator(Events.COMMENT_VOTED),
        (
          payload: { commentVoted: { id: number } } | undefined,
          variables: { commentId: string } | undefined
        ) => {
          if (!payload || !variables) return false;
          return payload.commentVoted.id === parseInt(variables.commentId);
        }
      ),
    },
  },
};
