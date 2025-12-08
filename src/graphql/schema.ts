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
    """Full name for Google auth users (optional)"""
    name: String
    """Email address (unique)"""
    email: String!
    """User bio"""
    bio: String
    """User avatar URL"""
    avatarUrl: String
    """Posts by this user"""
    posts(limit: Int = 20, offset: Int = 0): [Post!]!
    """Comments by this user"""
    comments(limit: Int = 20, offset: Int = 0): [Comment!]!
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
    """Community creator"""
    creator: User
    """Number of members"""
    memberCount: Int!
    """List of community members (first 50)"""
    members(limit: Int = 50, offset: Int = 0): [User!]!
    """List of community moderators"""
    moderators: [Moderator!]!
    """Community creation timestamp"""
    createdAt: DateTime!
    """Last update timestamp"""
    updatedAt: DateTime!
    """Whether the authenticated user has joined this community"""
    isJoined: Boolean
    """Whether the authenticated user is a moderator of this community"""
    isModerator: Boolean
  }

  """
  Represents a moderator of a community
  """
  type Moderator {
    """User information"""
    user: User!
    """Role: owner or moderator"""
    role: String!
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
  Report reason enumeration
  """
  enum ReportReason {
    spam
    harassment
    hate_speech
    violence
    inappropriate_content
    copyright_violation
    other
  }

  """
  Represents a report on a post or comment
  """
  type Report {
    """Unique identifier for the report"""
    id: ID!
    """User who submitted the report"""
    reporter: User!
    """Post being reported (null if reporting a comment)"""
    post: Post
    """Comment being reported (null if reporting a post)"""
    comment: Comment
    """Reason for the report"""
    reason: ReportReason!
    """Additional description"""
    description: String
    """Report status"""
    status: String!
    """Report creation timestamp"""
    createdAt: DateTime!
    """Report resolution timestamp"""
    resolvedAt: DateTime
    """User who resolved the report"""
    resolvedBy: User
  }

  """
  Input for creating a report
  """
  input CreateReportInput {
    """Post ID to report (optional if reporting a comment)"""
    postId: ID
    """Comment ID to report (optional if reporting a post)"""
    commentId: ID
    """Reason for the report"""
    reason: ReportReason!
    """Additional description"""
    description: String
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
  Input for updating a post
  """
  input UpdatePostInput {
    """New post title (max 300 characters)"""
    title: String
    """New post content/body"""
    content: String
    """New flair IDs to attach"""
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
  Input for creating a new community
  """
  input CreateCommunityInput {
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
  }

  """
  Input for updating a community
  """
  input UpdateCommunityInput {
    """New display name"""
    displayName: String
    """New description"""
    description: String
    """New icon URL"""
    iconUrl: String
    """New banner URL"""
    bannerUrl: String
  }

  """
  Input for creating a new flair
  """
  input CreateFlairInput {
    """Community ID to create flair for"""
    communityId: ID!
    """Flair label text"""
    label: String!
    """Text color (hex)"""
    color: String
    """Background color (hex)"""
    backgroundColor: String
  }

  """
  Input for updating a flair
  """
  input UpdateFlairInput {
    """New flair label text"""
    label: String
    """New text color (hex)"""
    color: String
    """New background color (hex)"""
    backgroundColor: String
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
    Search users by username

    **Parameters:**
    - query: Search query (minimum 2 characters)
    - limit: Number of results per page (default: 20, max: 100)
    - offset: Number of results to skip (default: 0)

    **Example:**
    \`\`\`graphql
    query {
      searchUsers(query: "john", limit: 10, offset: 0) {
        id
        username
        email
        createdAt
      }
    }
    \`\`\`
    """
    searchUsers(query: String!, limit: Int = 20, offset: Int = 0): [User!]!
    
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

    """
    Get saved posts for the current user

    **Authentication:** Required

    **Parameters:**
    - limit: Number of results per page (default: 20, max: 100)
    - offset: Number of results to skip (default: 0)

    **Example:**
    \`\`\`graphql
    query {
      savedPosts(limit: 20, offset: 0) {
        id
        title
        score
        community {
          name
          displayName
        }
        author {
          username
        }
        savedAt
      }
    }
    \`\`\`
    """
    savedPosts(limit: Int = 20, offset: Int = 0): [Post!]!

    """
    Get flairs for a community

    **Parameters:**
    - communityId: Community ID (required)

    **Example:**
    \`\`\`graphql
    query {
      flairsByCommunity(communityId: "1") {
        id
        label
        color
        backgroundColor
      }
    }
    \`\`\`
    """
    flairsByCommunity(communityId: ID!): [Flair!]!

    """
    Get posts by a specific user

    **Parameters:**
    - userId: User ID (required)
    - limit: Number of results per page (default: 20)
    - offset: Number of results to skip (default: 0)

    **Example:**
    \`\`\`graphql
    query {
      userPosts(userId: "1", limit: 20, offset: 0) {
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
    userPosts(userId: ID!, limit: Int = 20, offset: Int = 0): [Post!]!

    """
    Get comments by a specific user

    **Parameters:**
    - userId: User ID (required)
    - limit: Number of results per page (default: 20)
    - offset: Number of results to skip (default: 0)

    **Example:**
    \`\`\`graphql
    query {
      userComments(userId: "1", limit: 20, offset: 0) {
        id
        content
        score
        post {
          id
          title
        }
      }
    }
    \`\`\`
    """
    userComments(userId: ID!, limit: Int = 20, offset: Int = 0): [Comment!]!

    """
    Search communities by name or display name

    **Parameters:**
    - query: Search query (required)
    - limit: Number of results per page (default: 20)
    - offset: Number of results to skip (default: 0)

    **Example:**
    \`\`\`graphql
    query {
      searchCommunities(query: "programming", limit: 10) {
        id
        name
        displayName
        memberCount
      }
    }
    \`\`\`
    """
    searchCommunities(query: String!, limit: Int = 20, offset: Int = 0): [Community!]!

    """
    Search posts by title or content

    **Parameters:**
    - query: Search query (required)
    - communityId: Filter by community (optional)
    - limit: Number of results per page (default: 20)
    - offset: Number of results to skip (default: 0)

    **Example:**
    \`\`\`graphql
    query {
      searchPosts(query: "javascript", limit: 10) {
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
    searchPosts(query: String!, communityId: ID, limit: Int = 20, offset: Int = 0): [Post!]!

    """
    Get reports (moderator/admin only)

    **Authentication:** Required (must be moderator)

    **Parameters:**
    - status: Filter by status (optional: 'pending', 'resolved', 'dismissed')
    - limit: Number of results per page (default: 20)
    - offset: Number of results to skip (default: 0)

    **Example:**
    \`\`\`graphql
    query {
      reports(status: "pending", limit: 20) {
        id
        reason
        status
        reporter {
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
    reports(status: String, limit: Int = 20, offset: Int = 0): [Report!]!

    """
    Get a specific report by ID (moderator/admin only)

    **Authentication:** Required (must be moderator)

    **Example:**
    \`\`\`graphql
    query {
      report(id: "1") {
        id
        reason
        description
        status
        reporter {
          username
        }
      }
    }
    \`\`\`
    """
    report(id: ID!): Report
  }

  """
  Input for updating a user
  """
  input UpdateUserInput {
    """New username (3-50 characters, alphanumeric + underscore)"""
    username: String
    """New email address"""
    email: String
  }

  type Mutation {

    """
    Update user information

    **Authentication:** Required (must be the user themselves)

    **Example:**
    \`\`\`graphql
    mutation {
      updateUser(userId: "1", input: {
        username: "new_username"
        email: "newemail@example.com"
      }) {
        id
        username
        email
      }
    }
    \`\`\`
    """
    updateUser(userId: ID!, input: UpdateUserInput!): User!

    """
    Delete a user account

    **Authentication:** Required (must be the user themselves)

    **Example:**
    \`\`\`graphql
    mutation {
      deleteUser(userId: "1")
    }
    \`\`\`
    """
    deleteUser(userId: ID!): Boolean!

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
    Create a new community

    **Authentication:** Required

    **Example:**
    \`\`\`graphql
    mutation {
      createCommunity(input: {
        name: "programming"
        displayName: "Programming"
        description: "All about programming"
      }) {
        id
        name
        displayName
        description
      }
    }
    \`\`\`
    """
    createCommunity(input: CreateCommunityInput!): Community!

    """
    Update community information

    **Authentication:** Required (must be community owner or admin)

    **Example:**
    \`\`\`graphql
    mutation {
      updateCommunity(communityId: "1", input: {
        displayName: "New Programming Community"
        description: "Updated description"
      }) {
        id
        displayName
        description
      }
    }
    \`\`\`
    """
    updateCommunity(communityId: ID!, input: UpdateCommunityInput!): Community!

    """
    Delete a community

    **Authentication:** Required (must be community owner or admin)

    **Example:**
    \`\`\`graphql
    mutation {
      deleteCommunity(communityId: "1")
    }
    \`\`\`
    """
    deleteCommunity(communityId: ID!): Boolean!

    """
    Create a new flair for a community

    **Authentication:** Required (must be community moderator or admin)

    **Example:**
    \`\`\`graphql
    mutation {
      createFlair(input: {
        communityId: "1"
        label: "Discussion"
        color: "#ffffff"
        backgroundColor: "#ff0000"
      }) {
        id
        label
        color
        backgroundColor
      }
    }
    \`\`\`
    """
    createFlair(input: CreateFlairInput!): Flair!

    """
    Update a flair

    **Authentication:** Required (must be community moderator or admin)

    **Example:**
    \`\`\`graphql
    mutation {
      updateFlair(flairId: "1", input: {
        label: "Updated Label"
        color: "#000000"
      }) {
        id
        label
        color
        backgroundColor
      }
    }
    \`\`\`
    """
    updateFlair(flairId: ID!, input: UpdateFlairInput!): Flair!

    """
    Delete a flair

    **Authentication:** Required (must be community moderator or admin)

    **Example:**
    \`\`\`graphql
    mutation {
      deleteFlair(flairId: "1")
    }
    \`\`\`
    """
    deleteFlair(flairId: ID!): Boolean!

    """
    Report a post or comment

    **Authentication:** Required

    **Example:**
    \`\`\`graphql
    mutation {
      createReport(input: {
        postId: "1"
        reason: spam
        description: "This post contains spam content"
      }) {
        id
        reason
        status
      }
    }
    \`\`\`
    """
    createReport(input: CreateReportInput!): Report!

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
    Update a post

    **Authentication:** Required (must be the author)

    **Parameters:**
    - postId: Post ID (required)
    - input: Post update data
      - title: New title (optional)
      - content: New content (optional)
      - flairIds: New flair IDs (optional)

    **Example:**
    \`\`\`graphql
    mutation {
      updatePost(postId: "1", input: {
        title: "Updated title"
        content: "Updated content"
        flairIds: ["2", "3"]
      }) {
        id
        title
        content
        flairs {
          label
        }
      }
    }
    \`\`\`
    """
    updatePost(postId: ID!, input: UpdatePostInput!): Post!

    """
    Delete a post

    **Authentication:** Required (must be the author or admin)

    **Example:**
    \`\`\`graphql
    mutation {
      deletePost(postId: "1")
    }
    \`\`\`
    """
    deletePost(postId: ID!): Boolean!

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

    """
    Resolve a report (moderator/admin only)

    **Authentication:** Required (must be moderator)

    **Parameters:**
    - reportId: Report ID (required)
    - status: New status ('resolved' or 'dismissed')

    **Example:**
    \`\`\`graphql
    mutation {
      resolveReport(reportId: "1", status: "resolved") {
        id
        status
        resolvedAt
        resolvedBy {
          username
        }
      }
    }
    \`\`\`
    """
    resolveReport(reportId: ID!, status: String!): Report!

    """
    Add a moderator to a community (owner only)

    **Authentication:** Required (must be community owner)

    **Parameters:**
    - communityId: Community ID (required)
    - userId: User ID to add as moderator (required)

    **Example:**
    \`\`\`graphql
    mutation {
      addModerator(communityId: "1", userId: "2") {
        id
        name
        moderators {
          user {
            username
          }
          role
        }
      }
    }
    \`\`\`
    """
    addModerator(communityId: ID!, userId: ID!): Community!

    """
    Remove a moderator from a community (owner only)

    **Authentication:** Required (must be community owner)

    **Parameters:**
    - communityId: Community ID (required)
    - userId: User ID to remove as moderator (required)

    **Example:**
    \`\`\`graphql
    mutation {
      removeModerator(communityId: "1", userId: "2")
    }
    \`\`\`
    """
    removeModerator(communityId: ID!, userId: ID!): Boolean!
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
