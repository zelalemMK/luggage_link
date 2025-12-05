
import { storage } from "./server/storage";
import { insertReviewSchema } from "@shared/schema";

async function main() {
    try {
        console.log("Attempting to create a review for a non-existent user...");

        // Create a user first to be the reviewer.
        const reviewer = await storage.createUser({
            firstName: "Test",
            lastName: "Reviewer",
            email: `test-reviewer-${Date.now()}@example.com`,
            password: "password",
            firebaseUid: `uid-${Date.now()}`
        });

        console.log("Created reviewer with ID:", reviewer.id);

        const nonExistentUserId = 999999;

        const reviewData = {
            reviewerId: reviewer.id,
            revieweeId: nonExistentUserId,
            rating: 5,
            comment: "This should fail",
        };

        // Validate with schema first (as route handler does)
        const validatedData = insertReviewSchema.parse(reviewData);

        // Call storage.createReview
        await storage.createReview(validatedData);

        console.log("Review created successfully (Unexpected!)");
    } catch (error) {
        console.log("Caught error:");
        console.log(error);
    } finally {
        process.exit(0);
    }
}

main();
