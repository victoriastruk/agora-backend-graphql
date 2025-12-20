import { db } from "@/db/client";
import { users } from "@/db/schema";
import { AuthUtils } from "@/utils/auth";

const mockUsers = [
  {
    username: "johndoe",
    email: "john.doe@example.com",
    password: "password123",
  },
  {
    username: "janedoe",
    email: "jane.doe@example.com",
    password: "password123",
  },
  {
    username: "bobsmith",
    email: "bob.smith@example.com",
    password: "password123",
  },
  {
    username: "alicejohnson",
    email: "alice.johnson@example.com",
    password: "password123",
  },
  {
    username: "charliebrown",
    email: "charlie.brown@example.com",
    password: "password123",
  },
];

export async function seed() {
  try {
    console.log("🌱 Starting database seeding...");

    console.log("🧹 Clearing existing users...");
    await db.delete(users);

    const usersWithHashedPasswords = await Promise.all(
      mockUsers.map(async (user) => ({
        username: user.username,
        email: user.email,
        passwordHash: await AuthUtils.hashPassword(user.password),
      }))
    );

    await db.insert(users).values(usersWithHashedPasswords);

    console.log("✅ Database seeded successfully!");
    console.log(`📊 Inserted ${mockUsers.length} users`);
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  seed().then(() => process.exit(0));
}
