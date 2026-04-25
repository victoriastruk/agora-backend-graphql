export const commentTypeDefs = /* GraphQL */ `
  """Represents a comment on a post"""
  type Comment {
    """Unique identifier for the comment"""
    id: ID!
    """Post this comment belongs to"""
    post: Post!
    """User who created the comment"""
    author: User!
    """Comment content"""
    content: String!
    """Comment score (upvotes - downvotes)"""
    score: Int!
    """Current user's vote on this comment (if authenticated)"""
    userVote: VoteType
    """Parent comment ID (for nested comments)"""
    parentId: ID
    """Replies to this comment"""
    replies: [Comment!]!
    """Comment creation timestamp"""
    createdAt: DateTime!
    """Last update timestamp"""
    updatedAt: DateTime!
  }

  """Input for creating a comment"""
  input CreateCommentInput {
    """Post ID to comment on"""
    postId: ID!
    """Comment content (required)"""
    content: String!
    """Parent comment ID (for replies, optional)"""
    parentId: ID
  }

  extend type Query {
    """Get comments for a post in tree structure"""
    comments(postId: ID!, limit: Int = 50, offset: Int = 0): [Comment!]!
    """Get a specific comment by ID"""
    comment(id: ID!): Comment
  }

  extend type Mutation {
    """Create a comment on a post (auth required)"""
    createComment(input: CreateCommentInput!): Comment!
    """Update a comment (auth required, must be the author)"""
    updateComment(commentId: ID!, content: String!): Comment!
    """Delete a comment (auth required, must be the author)"""
    deleteComment(commentId: ID!): Boolean!
  }
`;
