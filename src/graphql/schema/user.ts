// export const userTypeDefs = `
//    type User {
//       id: ID!
//       username: String!
//       name: String
//       email: String!
//       bio: String
//       avatarUrl: String
//       posts(limit: Int = 20, offset: Int = 0): [Post!]!
//       comments(limit: Int = 20, offset: Int = 0): [Comment!]!
//       createdAt: DateTime!
//   }
//    `;


export const userTypeDefs = /* GraphQL */ `
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
  Input for updating a user
  """
  input UpdateUserInput {
    """New username (3-50 characters, alphanumeric + underscore)"""
    username: String
    """New email address"""
    email: String
  }

  extend type Query {
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
    Get the currently authenticated user

    **Authentication:** Required

    **Example:**
    \`\`\`graphql
    query {
      me {
        id
        username
        email
      }
    }
    \`\`\`
    """
    me: User
  }

  extend type Mutation {
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
  }
`;