export const voteTypeDefs = /* GraphQL */ `
  extend type Mutation {
    """Vote on a post — same vote again removes it (auth required)"""
    votePost(postId: ID!, voteType: VoteType!): Post!
    """Vote on a comment — same vote again removes it (auth required)"""
    voteComment(commentId: ID!, voteType: VoteType!): Comment!
  }
`;
