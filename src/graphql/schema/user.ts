export const userTypeDefs = `
  type User {
    id: ID!
    username: String!
    name: String
    email: String!
    bio: String
    avatarUrl: String
    bannerUrl: String
    socialLinks: [SocialLink!]!
    posts(limit: Int = 20, offset: Int = 0): [Post!]!
    comments(limit: Int = 20, offset: Int = 0): [Comment!]!
    createdAt: DateTime!
  }

  type SocialLink {
    id: ID!
    label: String!
    url: String!
    position: Int!
  }

  input UpdateUserInput {
    name: String
    bio: String
    avatarUrl: String
    bannerUrl: String
  }

  input AddSocialLinkInput {
    label: String!
    url: String!
  }

  input UpdateSocialLinkInput {
    label: String
    url: String
  }

  extend type Query {
    users(limit: Int = 20, offset: Int = 0): [User!]!
    searchUsers(query: String!, limit: Int = 20, offset: Int = 0): [User!]!
    user(id: ID!): User
    userByUsername(username: String!): User
    me: User
  }

  extend type Mutation {
    updateUser(userId: ID!, input: UpdateUserInput!): User!
    deleteUser(userId: ID!): Boolean!
    addSocialLink(input: AddSocialLinkInput!): SocialLink!
    updateSocialLink(linkId: ID!, input: UpdateSocialLinkInput!): SocialLink!
    removeSocialLink(linkId: ID!): Boolean!
  }
`;