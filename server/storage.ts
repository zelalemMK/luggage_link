// server/storage.ts
import {
  users,
  emailVerifications,
  trips,
  packages,
  deliveries,
  messages,
  reviews,
  type User,
  type Trip,
  type Package,
  type Delivery,
  type Message,
  type Review,
  type InsertUser,
  type InsertTrip,
  type InsertPackage,
  type InsertDelivery,
  type InsertMessage,
  type InsertReview,
} from "@shared/schema";

import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import session from "express-session";
import createMemoryStore from "memorystore";
import { drizzle } from "drizzle-orm/node-postgres";

import { eq, or, and, desc } from "drizzle-orm";

import pkg from "pg";

import { DATABASE_URL } from "./env";

const { Pool } = pkg;
const scryptAsync = promisify(scrypt);
const MemoryStore = createMemoryStore(session);

// ------------------ Password hashing ------------------
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// ------------------ Database ------------------
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  max: 20, // keep some open connections
  idleTimeoutMillis: 30000, // 30 seconds

});


export const db = drizzle(pool);

// ------------------ Email verification helpers ------------------
export async function createEmailVerificationToken(userId: number) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
  await db.insert(emailVerifications).values({ userId, token, expiresAt });
  return token;
}

export async function getVerificationByToken(token: string) {
  const [record] = await db.select().from(emailVerifications).where(eq(emailVerifications.token, token)).limit(1);
  return record;
}

export async function verifyUserEmail(userId: number) {
  await db.update(users).set({ isVerified: true }).where(eq(users.id, userId));
  await db.delete(emailVerifications).where(eq(emailVerifications.userId, userId));
}

// ------------------ Postgres Storage ------------------
export class PostgresStorage {
  sessionStore: session.SessionStore;

  constructor() {
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // 24 hours
    });
  }

  // ------------------ User operations ------------------
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return user;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        isVerified: false,
        verificationStatus: { idVerified: false, phoneVerified: false, addressVerified: false },
        rating: 0,
        reviewCount: 0,
      })
      .returning();
    return user;
  }

  async updateUserVerification(userId: number, verificationData: Partial<User["verificationStatus"]>): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");

    const updatedVerificationStatus = { ...user.verificationStatus, ...verificationData };
    const isFullyVerified = Object.values(updatedVerificationStatus).every((v) => v === true);

    const [updatedUser] = await db
      .update(users)
      .set({ verificationStatus: updatedVerificationStatus, isVerified: isFullyVerified })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }

  // ------------------ Trip operations ------------------
  async getTrip(id: number): Promise<Trip | undefined> {
    const [trip] = await db.select().from(trips).where(eq(trips.id, id));
    return trip;
  }

  /**
   * Get all active trips with optional filters.
   * Filters object should use trip property names (departureAirport, destinationCity, departureDate, availableWeight).
   */
  async getTrips(filters?: Partial<Trip>): Promise<Trip[]> {
    let q = db.select().from(trips).where(eq(trips.isActive, true));

    if (filters) {
      if (filters.departureAirport) q = q.where(eq(trips.departureAirport, filters.departureAirport));
      if (filters.destinationCity) q = q.where(eq(trips.destinationCity, filters.destinationCity));
      if (filters.departureDate) q = q.where(eq(trips.departureDate, new Date(filters.departureDate)));
      if (filters.availableWeight !== undefined) q = q.where(eq(trips.availableWeight, filters.availableWeight));
    }

    // order by newest departures first (or createdAt if you prefer)
    const rows = await q.orderBy(desc(trips.createdAt));
    return rows;
  }

  /**
   * Get trips for a specific numeric user ID
   */
  async getTripsByUserId(userId: number): Promise<Trip[]> {
    const rows = await db.select().from(trips).where(eq(trips.userId, userId)).orderBy(desc(trips.departureDate));
    return rows;
  }

  async createTrip(tripData: InsertTrip, userId: number): Promise<Trip> {
    const [trip] = await db
      .insert(trips)
      .values({ ...tripData, userId, isActive: true })
      .returning();
    return trip;
  }

  async updateTrip(id: number, tripData: Partial<Trip>): Promise<Trip | undefined> {
    const [updatedTrip] = await db.update(trips).set(tripData).where(eq(trips.id, id)).returning();
    return updatedTrip;
  }

  // ------------------ Package operations ------------------
  async getPackage(id: number): Promise<Package | undefined> {
    const [pkg] = await db.select().from(packages).where(eq(packages.id, id));
    return pkg;
  }

  async createPackage(packageData: InsertPackage, userId: number): Promise<Package> {
    const [pkg] = await db
      .insert(packages)
      .values({ ...packageData, userId, status: "pending", isActive: true })
      .returning();
    return pkg;
  }

  async updatePackage(id: number, packageData: Partial<Package>): Promise<Package | undefined> {
    const [updatedPackage] = await db.update(packages).set(packageData).where(eq(packages.id, id)).returning();
    return updatedPackage;
  }

  // ------------------ Delivery operations ------------------
  async getDelivery(id: number): Promise<Delivery | undefined> {
    const [delivery] = await db.select().from(deliveries).where(eq(deliveries.id, id));
    return delivery;
  }

  async createDelivery(deliveryData: InsertDelivery): Promise<Delivery> {
    const [delivery] = await db
      .insert(deliveries)
      .values({ ...deliveryData, status: "pending", paymentStatus: "pending" })
      .returning();

    // mark package matched
    await db.update(packages).set({ status: "matched" }).where(eq(packages.id, deliveryData.packageId));
    return delivery;
  }

  async updateDeliveryStatus(id: number, status: string): Promise<Delivery | undefined> {
    const [delivery] = await db.update(deliveries).set({ status }).where(eq(deliveries.id, id)).returning();
    if (status === "delivered" && delivery) {
      await db.update(packages).set({ status: "delivered" }).where(eq(packages.id, delivery.packageId));
    }
    return delivery;
  }

  async updatePaymentStatus(id: number, paymentStatus: string): Promise<Delivery | undefined> {
    const [delivery] = await db.update(deliveries).set({ paymentStatus }).where(eq(deliveries.id, id)).returning();
    return delivery;
  }

  // ------------------ Messages ------------------
  async createMessage(messageData: InsertMessage): Promise<Message> {
    const [message] = await db.insert(messages).values({ ...messageData, isRead: false }).returning();
    return message;
  }
  async markMessagesAsRead(messageIds: number[]) {
    if (!messageIds.length) return;
    const rows = await db.update(messages).set({ isRead: true }).where(inArray(messages.id, messageIds)).returning();
    return rows;
  }


  async markMessageAsRead(id: number): Promise<Message | undefined> {
    const [message] = await db.update(messages).set({ isRead: true }).where(eq(messages.id, id)).returning();
    return message;
  }

  /**
   * Get messages for a user (either sent or received).
   * Returns selected message fields plus sender info under `sender`.
   */
  async getMessagesByUserId(userId: number | string) {
    try {
      const result = await db
        .select({
          id: messages.id,
          content: messages.content,
          senderId: messages.senderId,
          receiverId: messages.receiverId,
          isRead: messages.isRead,
          createdAt: messages.createdAt,
          sender: {
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            profileImage: users.profileImage,
          },
        })
        .from(messages)
        .leftJoin(users, eq(users.id, messages.senderId))
        .where(
          or(
            eq(messages.senderId, typeof userId === "number" ? userId : -1),
            eq(messages.receiverId, typeof userId === "number" ? userId : -1)
          )
        )
        .orderBy(desc(messages.createdAt));

      return result;
    } catch (error) {
      console.error("❌ Error fetching messages:", error);
      throw error;
    }
  }

  // ------------------ Reviews ------------------
  async createReview(reviewData: InsertReview): Promise<Review> {
    const [review] = await db.insert(reviews).values(reviewData).returning();

    // update rating
    const userReviews = await db.select().from(reviews).where(eq(reviews.revieweeId, reviewData.revieweeId));
    const newRating = userReviews.reduce((sum, r) => sum + r.rating, 0) / userReviews.length;
    await db
      .update(users)
      .set({ rating: newRating, reviewCount: userReviews.length })
      .where(eq(users.id, reviewData.revieweeId));

    return review;
  }

  async getReviewsByUserId(userId: number, role: "reviewer" | "reviewee"): Promise<Review[]> {
    const rows = await db
      .select()
      .from(reviews)
      .where(role === "reviewer" ? eq(reviews.reviewerId, userId) : eq(reviews.revieweeId, userId))
      .orderBy(desc(reviews.createdAt));
    return rows;
  }

  // ------------------ Packages by user ID (supports numeric userId) ------------------
  async getPackagesByUserId(userId: number | string) {
    const rows = await db
      .select()
      .from(packages)
      .leftJoin(users, eq(users.id, packages.userId))
      .where(
        or(
          eq(packages.userId, typeof userId === "number" ? userId : -1),
          eq(users.firebaseUid, typeof userId === "string" ? userId : "")
        )
      )
      .orderBy(desc(packages.id));

    // Flatten for backward compatibility with previous front-end expectations
    return rows.map((r) => ({
      ...r.packages,
      user: r.users,
    }));
  }
  // ------------------ Get all packages (with optional filters) ------------------
  async getPackages(filters?: Partial<Package>, includeInactive = false) {
    let q = db.select().from(packages).orderBy(desc(packages.createdAt));

    if (!includeInactive) {
      q = q.where(eq(packages.isActive, true));
    }

    if (filters) {
      if (filters.senderCity) q = q.where(eq(packages.senderCity, filters.senderCity));
      if (filters.receiverCity) q = q.where(eq(packages.receiverCity, filters.receiverCity));
      if (filters.packageType) q = q.where(eq(packages.packageType, filters.packageType));
      if (filters.weight) q = q.where(eq(packages.weight, filters.weight));
      if (filters.deliveryDeadline) q = q.where(eq(packages.deliveryDeadline, filters.deliveryDeadline));
    }

    const rows = await q;
    return rows;
  }
  // ------------------ Get messages between two users ------------------
  // inside PostgresStorage class
  async getMessagesBetweenUsers(user1Id: number | string, user2Id: number | string) {
    try {
      const result = await db
        .select()
        .from(messages)
        .where(
          or(
            and(eq(messages.senderId, user1Id), eq(messages.receiverId, user2Id)),
            and(eq(messages.senderId, user2Id), eq(messages.receiverId, user1Id))
          )
        )
        // ASC = oldest first; frontend groups and renders chronologically
        .orderBy(messages.createdAt); // default ascending
      return result;
    } catch (error) {
      console.error("❌ Error fetching messages between users:", error);
      throw error;
    }
  }


}

export const storage = new PostgresStorage();
