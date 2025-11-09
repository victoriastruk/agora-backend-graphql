import { makeExecutableSchema } from '@graphql-tools/schema';
import { resolvers } from './resolvers';

const typeDefs = `
  scalar DateTime

  """
  Represents a user in the system
  """
  type User {
    """Unique identifier for the user"""
    id: ID!
    """Username (unique, 3-50 characters)"""
    username: String!
    """Full name for Google auth users"""
    name: String!
    """Email address (unique)"""
    email: String!
    """Account creation timestamp"""
    createdAt: DateTime!
  }

  """
  Represents a community (subreddit)
  """
  type Community {
    """Unique identifier for the community"""
    id: ID!
    """URL-friendly name (e.g., 'programming')"""
    name: String!
    """Display name (e.g., 'Programming')"""
    displayName: String!
    """Community description"""
    description: String
    """Community icon URL"""
    iconUrl: String
    """Community banner URL"""
    bannerUrl: String
    """Number of members"""
    memberCount: Int!
    """List of community members (first 50)"""
    members(limit: Int = 50, offset: Int = 0): [User!]!
    """Community creation timestamp"""
    createdAt: DateTime!
    """Last update timestamp"""
    updatedAt: DateTime!
    """Whether the authenticated user has joined this community"""
    isJoined: Boolean
  }

  """
  Represents a flair/tag for posts
  """
  type Flair {
    """Unique identifier for the flair"""
    id: ID!
    """Flair label text"""
    label: String!
    """Text color (hex)"""
    color: String
    """Background color (hex)"""
    backgroundColor: String
  }

  """
  Represents media attached to a post (image, video, link)
  """
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

  """
  Represents a post in the system
  """
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

  """
  Represents a comment on a post
  """
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

  """
  Post content type
  """
  enum PostType {
    """Text-only post"""
    text
    """Image post"""
    image
    """Video post"""
    video
    """Link post"""
    link
    """Poll post"""
    poll
  }

  """
  Vote type for posts and comments
  """
  enum VoteType {
    """Upvote"""
    upvote
    """Downvote"""
    downvote
  }

  """
  Sort order for post feeds
  """
  enum SortType {
    """Best posts (score + comments weighted)"""
    best
    """Hot posts (score weighted by time)"""
    hot
    """Newest posts"""
    new
    """Rising posts (recent high-scoring)"""
    rising
    """Top posts (highest score)"""
    top
  }

  """
  Sort order for posts (alias for SortType for backward compatibility)
  """
  enum PostSort {
    """Best posts (score + comments weighted)"""
    best
    """Hot posts (score weighted by time)"""
    hot
    """Newest posts"""
    new
    """Rising posts (recent high-scoring)"""
    rising
    """Top posts (highest score)"""
    top
  }

  """
  Geographic region for content filtering
  """
  enum Region {
    """All regions"""
    all
    """North America"""
    north_america
    """Europe"""
    europe
    """Asia"""
    asia
    """Australia"""
    australia
    """South America"""
    south_america
    """Africa"""
    africa
  }

  """
  Input for creating a new post
  """
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

  """
  Input for post media
  """
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

  """
  Input for creating a comment
  """
  input CreateCommentInput {
    """Post ID to comment on"""
    postId: ID!
    """Comment content (required)"""
    content: String!
    """Parent comment ID (for replies, optional)"""
    parentId: ID
  }

  type Query {
    """
    Get paginated list of all users
    
    **Pagination:**
    - limit: Number of results per page (default: 20, max: 100)
    - offset: Number of results to skip (default: 0)
    
    **Example:**
    \`\`\`graphql
    query {
      users(limit: 10, offset: 0) {
        id
        username
        email
      }
    }
    \`\`\`
    """
    users(limit: Int = 20, offset: Int = 0): [User!]!
    
    """
    Get a specific user by ID
    
    **Example:**
    \`\`\`graphql
    query {
      user(id: "1") {
        id
        username
        email
        createdAt
      }
    }
    \`\`\`
    """
    user(id: ID!): User

    """
    Get paginated list of all communities
    
    **Pagination:**
    - limit: Number of results per page (default: 20, max: 100)
    - offset: Number of results to skip (default: 0)
    
    **Example:**
    \`\`\`graphql
    query {
      communities(limit: 20, offset: 0) {
        id
        name
        displayName
        memberCount
        isJoined
      }
    }
    \`\`\`
    """
    communities(limit: Int = 20, offset: Int = 0): [Community!]!
    
    """
    Get a specific community by ID
    
    **Example:**
    \`\`\`graphql
    query {
      community(id: "1") {
        id
        name
        displayName
        description
        memberCount
      }
    }
    \`\`\`
    """
    community(id: ID): Community
    
    """
    Get a community by its URL-friendly name
    
    **Example:**
    \`\`\`graphql
    query {
      communityByName(name: "programming") {
        id
        name
        displayName
        memberCount
      }
    }
    \`\`\`
    """
    communityByName(name: String!): Community
    
    """
    Get popular communities sorted by member count
    
    **Parameters:**
    - limit: Number of results (default: 10, max: 50)
    
    **Example:**
    \`\`\`graphql
    query {
      popularCommunities(limit: 10) {
        id
        name
        displayName
        memberCount
        iconUrl
      }
    }
    \`\`\`
    """
    popularCommunities(limit: Int = 10): [Community!]!

    """
    Get paginated list of all posts

    **Pagination:**
    - limit: Number of results per page (default: 20, max: 100)
    - offset: Number of results to skip (default: 0)

    **Filtering:**
    - region: Filter posts by geographic region (default: all)
    - communityId: Filter posts by specific community
    - sort: Sort order for posts (default: best)

    **Example:**
    \`\`\`graphql
    query {
      posts(region: north_america, sort: hot, limit: 20, offset: 0) {
        id
        title
        score
        commentCount
        community {
          name
          displayName
        }
        author {
          username
        }
      }
    }
    \`\`\`
    """
    posts(communityId: ID, region: Region = all, sort: SortType = best, limit: Int = 20, offset: Int = 0): [Post!]!
    
    """
    Get a specific post by ID with all relations
    
    **Example:**
    \`\`\`graphql
    query {
      post(id: "1") {
        id
        title
        content
        score
        community {
          name
          displayName
        }
        author {
          username
        }
        media {
          type
          url
        }
        flairs {
          label
          color
        }
      }
    }
    \`\`\`
    """
    post(id: ID!): Post
    
    """
    Get personalized feed of posts with sorting options
    
    **Parameters:**
    - sort: Sort order (default: best)
      - best: Score + comment count weighted
      - hot: Score weighted by time (last 24h)
      - new: Newest posts first
      - rising: Recent high-scoring posts
      - top: Highest score
    - limit: Number of results per page (default: 20, max: 100)
    - offset: Number of results to skip (default: 0)
    
    **Authentication:** Optional - if authenticated, feed may be personalized
    
    **Example:**
    \`\`\`graphql
    query {
      feed(sort: hot, limit: 20, offset: 0) {
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
        userVote
        isSaved
      }
    }
    \`\`\`
    """
    feed(sort: SortType = best, limit: Int = 20, offset: Int = 0): [Post!]!
    
    """
    Get top stories for hero carousel
    
    **Parameters:**
    - limit: Number of results (default: 6, max: 20)
    
    Returns top-scoring posts from the last 24 hours.
    
    **Example:**
    \`\`\`graphql
    query {
      topStories(limit: 6) {
        id
        title
        score
        community {
          name
          displayName
          iconUrl
        }
        media {
          type
          url
          thumbnailUrl
        }
      }
    }
    \`\`\`
    """
    topStories(limit: Int = 6): [Post!]!
    
    """
    Get posts from a specific community
    
    **Parameters:**
    - communityId: Community ID (required)
    - limit: Number of results per page (default: 20, max: 100)
    - offset: Number of results to skip (default: 0)
    
    **Example:**
    \`\`\`graphql
    query {
      postsByCommunity(communityId: "1", limit: 20, offset: 0) {
        id
        title
        score
        commentCount
        author {
          username
        }
      }
    }
    \`\`\`
    """
    postsByCommunity(communityId: ID!, limit: Int = 20, offset: Int = 0): [Post!]!

    """
    Get comments for a post in tree structure
    
    **Parameters:**
    - postId: Post ID (required)
    - limit: Number of results per page (default: 50, max: 100)
    - offset: Number of results to skip (default: 0)
    
    Returns comments in a nested tree structure with replies.
    
    **Example:**
    \`\`\`graphql
    query {
      comments(postId: "1", limit: 50, offset: 0) {
        id
        content
        score
        author {
          username
        }
        replies {
          id
          content
          author {
            username
          }
        }
      }
    }
    \`\`\`
    """
    comments(postId: ID!, limit: Int = 50, offset: Int = 0): [Comment!]!
    
    """
    Get a specific comment by ID
    
    **Example:**
    \`\`\`graphql
    query {
      comment(id: "1") {
        id
        content
        score
        author {
          username
        }
        post {
          id
          title
        }
      }
    }
    \`\`\`
    """
    comment(id: ID!): Comment
  }

  type Mutation {
    """
    Join a community
    
    **Authentication:** Required
    
    **Example:**
    \`\`\`graphql
    mutation {
      joinCommunity(communityId: "1") {
        id
        name
        displayName
        isJoined
      }
    }
    \`\`\`
    """
    joinCommunity(communityId: ID!): Community!
    
    """
    Leave a community
    
    **Authentication:** Required
    
    **Example:**
    \`\`\`graphql
    mutation {
      leaveCommunity(communityId: "1")
    }
    \`\`\`
    """
    leaveCommunity(communityId: ID!): Boolean!

    """
    Create a new post
    
    **Authentication:** Required
    
    **Parameters:**
    - input: Post creation data
      - communityId: Community ID (required)
      - title: Post title (required, max 300 chars)
      - content: Post content (optional)
      - type: Post type (default: text)
      - media: Media attachments (optional)
      - flairIds: Flair IDs (optional)
    
    **Example:**
    \`\`\`graphql
    mutation {
      createPost(input: {
        communityId: "1"
        title: "My awesome post"
        content: "This is the content"
        type: text
        flairIds: ["1", "2"]
      }) {
        id
        title
        score
        community {
          name
        }
      }
    }
    \`\`\`
    """
    createPost(input: CreatePostInput!): Post!
    
    """
    Vote on a post (upvote or downvote)
    
    **Authentication:** Required
    
    **Parameters:**
    - postId: Post ID (required)
    - voteType: Vote type (upvote or downvote)
    
    Clicking the same vote button again removes the vote.
    Changing vote type updates the vote.
    
    **Example:**
    \`\`\`graphql
    mutation {
      votePost(postId: "1", voteType: upvote) {
        id
        score
        userVote
      }
    }
    \`\`\`
    """
    votePost(postId: ID!, voteType: VoteType!): Post!
    
    """
    Save a post for later
    
    **Authentication:** Required
    
    **Example:**
    \`\`\`graphql
    mutation {
      savePost(postId: "1")
    }
    \`\`\`
    """
    savePost(postId: ID!): Boolean!
    
    """
    Unsave a post
    
    **Authentication:** Required
    
    **Example:**
    \`\`\`graphql
    mutation {
      unsavePost(postId: "1")
    }
    \`\`\`
    """
    unsavePost(postId: ID!): Boolean!

    """
    Create a comment on a post
    
    **Authentication:** Required
    
    **Parameters:**
    - input: Comment creation data
      - postId: Post ID (required)
      - content: Comment content (required)
      - parentId: Parent comment ID for replies (optional)
    
    **Example:**
    \`\`\`graphql
    mutation {
      createComment(input: {
        postId: "1"
        content: "Great post!"
        parentId: null
      }) {
        id
        content
        score
        author {
          username
        }
      }
    }
    \`\`\`
    """
    createComment(input: CreateCommentInput!): Comment!
    
    """
    Vote on a comment (upvote or downvote)
    
    **Authentication:** Required
    
    **Parameters:**
    - commentId: Comment ID (required)
    - voteType: Vote type (upvote or downvote)
    
    **Example:**
    \`\`\`graphql
    mutation {
      voteComment(commentId: "1", voteType: upvote) {
        id
        score
        userVote
      }
    }
    \`\`\`
    """
    voteComment(commentId: ID!, voteType: VoteType!): Comment!
    
    """
    Update a comment
    
    **Authentication:** Required (must be the author)
    
    **Parameters:**
    - commentId: Comment ID (required)
    - content: New comment content (required)
    
    **Example:**
    \`\`\`graphql
    mutation {
      updateComment(commentId: "1", content: "Updated content") {
        id
        content
        updatedAt
      }
    }
    \`\`\`
    """
    updateComment(commentId: ID!, content: String!): Comment!
    
    """
    Delete a comment
    
    **Authentication:** Required (must be the author)
    
    **Example:**
    \`\`\`graphql
    mutation {
      deleteComment(commentId: "1")
    }
    \`\`\`
    """
    deleteComment(commentId: ID!): Boolean!
  }

  type Subscription {
    """
    Subscribe to new posts in real-time
    
    **Parameters:**
    - communityId: Optional - filter by community ID
    
    **Example:**
    \`\`\`graphql
    subscription {
      postAdded(communityId: "1") {
        id
        title
        score
        community {
          name
        }
        author {
          username
        }
      }
    }
    \`\`\`
    """
    postAdded(communityId: ID): Post!
    
    """
    Subscribe to post updates in real-time
    
    **Parameters:**
    - postId: Post ID (required)
    
    **Example:**
    \`\`\`graphql
    subscription {
      postUpdated(postId: "1") {
        id
        title
        score
        commentCount
      }
    }
    \`\`\`
    """
    postUpdated(postId: ID!): Post!
    
    """
    Subscribe to post vote changes in real-time
    
    **Parameters:**
    - postId: Post ID (required)
    
    **Example:**
    \`\`\`graphql
    subscription {
      postVoted(postId: "1") {
        id
        score
        userVote
      }
    }
    \`\`\`
    """
    postVoted(postId: ID!): Post!
    
    """
    Subscribe to new comments on a post in real-time
    
    **Parameters:**
    - postId: Post ID (required)
    
    **Example:**
    \`\`\`graphql
    subscription {
      commentAdded(postId: "1") {
        id
        content
        score
        author {
          username
        }
      }
    }
    \`\`\`
    """
    commentAdded(postId: ID!): Comment!
    
    """
    Subscribe to comment vote changes in real-time
    
    **Parameters:**
    - commentId: Comment ID (required)
    
    **Example:**
    \`\`\`graphql
    subscription {
      commentVoted(commentId: "1") {
        id
        score
        userVote
      }
    }
    \`\`\`
    """
    commentVoted(commentId: ID!): Comment!
  }
`;

export const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});
