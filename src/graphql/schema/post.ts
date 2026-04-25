export const postTypeDefs = /* GraphQL */ `
  """Post content type"""
  enum PostType {
    text
    image
    video
    link
    poll
  }

  """Represents media attached to a post (image, video, link)"""
  type PostMedia {
    """Unique identifier for the media"""
    id: ID!
    """Media type: 'image', 'video', or 'link'"""
    type: String!
    """Media URL"""
    url: String!
    """Thumbnail URL (for videos)"""
    thumbnailUrl: String
    """Thumbnail URL (alias for thumbnailUrl)"""
    thumb: String
    """Media width in pixels"""
    width: Int
    """Media height in pixels"""
    height: Int
  }

  """Represents a post in the system"""
  type Post {
    """Unique identifier for the post"""
    id: ID!
    """Community this post belongs to"""
    community: Community!
    """User who created the post"""
    author: User!
    """Post title (max 300 characters)"""
    title: String!
    """Post content/body text"""
    content: String
    """Post type"""
    type: PostType!
    """Post score (upvotes - downvotes)"""
    score: Int!
    """Number of comments"""
    commentCount: Int!
    """Comments on this post (paginated)"""
    comments(limit: Int = 50, offset: Int = 0): [Comment!]!
    """Media attachments"""
    media: [PostMedia!]!
    """Flairs/tags associated with the post"""
    flairs: [Flair!]!
    """Current user's vote on this post (if authenticated)"""
    userVote: VoteType
    """Whether the current user has saved this post"""
    isSaved: Boolean
    """Post creation timestamp"""
    createdAt: DateTime!
    """Last update timestamp"""
    updatedAt: DateTime!
  }

  """Input for creating a new post"""
  input CreatePostInput {
    """Community ID to post in"""
    communityId: ID!
    """Post title (required, max 300 characters)"""
    title: String!
    """Post content/body (optional)"""
    content: String
    """Post type (default: text)"""
    type: PostType = text
    """Media attachments (optional)"""
    media: [PostMediaInput!]
    """Flair IDs to attach (optional)"""
    flairIds: [ID!]
  }

  """Input for updating a post"""
  input UpdatePostInput {
    """New post title (max 300 characters)"""
    title: String
    """New post content/body"""
    content: String
    """New flair IDs to attach"""
    flairIds: [ID!]
  }

  """Input for post media"""
  input PostMediaInput {
    """Media type: 'image', 'video', or 'link'"""
    type: String!
    """Media URL"""
    url: String!
    """Thumbnail URL (for videos)"""
    thumbnailUrl: String
    """Media width in pixels"""
    width: Int
    """Media height in pixels"""
    height: Int
  }

  extend type Query {
    """Get paginated list of posts with optional filtering and sorting"""
    posts(
      communityId: ID
      region: Region = all
      sort: SortType = best
      limit: Int = 20
      offset: Int = 0
    ): [Post!]!
    """Get a specific post by ID"""
    post(id: ID!): Post
    """Get personalized feed of posts"""
    feed(sort: SortType = best, limit: Int = 20, offset: Int = 0): [Post!]!
    """Get top stories from the last 24 hours"""
    topStories(limit: Int = 6): [Post!]!
    """Get posts from a specific community"""
    postsByCommunity(communityId: ID!, limit: Int = 20, offset: Int = 0): [Post!]!
    """Search posts by title or content"""
    searchPosts(query: String!, communityId: ID, limit: Int = 20, offset: Int = 0): [Post!]!
    """Get saved posts for the current user (auth required)"""
    savedPosts(limit: Int = 20, offset: Int = 0): [Post!]!
    """Get posts by a specific user"""
    userPosts(userId: ID!, limit: Int = 20, offset: Int = 0): [Post!]!
    """Get comments by a specific user"""
    userComments(userId: ID!, limit: Int = 20, offset: Int = 0): [Comment!]!
  }

  extend type Mutation {
    """Create a new post (auth required)"""
    createPost(input: CreatePostInput!): Post!
    """Update a post (auth required, must be the author)"""
    updatePost(postId: ID!, input: UpdatePostInput!): Post!
    """Delete a post (auth required, must be the author or moderator)"""
    deletePost(postId: ID!): Boolean!
    """Save a post for later (auth required)"""
    savePost(postId: ID!): Boolean!
    """Unsave a previously saved post (auth required)"""
    unsavePost(postId: ID!): Boolean!
  }
`;
