export const subscriptionTypeDefs = /* GraphQL */ `
  extend type Subscription {
    """Subscribe to new posts in real-time"""
    postAdded(communityId: ID): Post!
    """Subscribe to post updates in real-time"""
    postUpdated(postId: ID!): Post!
    """Subscribe to post vote changes in real-time"""
    postVoted(postId: ID!): Post!
    """Subscribe to new comments on a post in real-time"""
    commentAdded(postId: ID!): Comment!
    """Subscribe to comment vote changes in real-time"""
    commentVoted(commentId: ID!): Comment!
  }
`;
