import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ReviewFormProps {
    onSubmit: (rating: number, comment: string) => Promise<void>;
    revieweeId: number;
    revieweeName: string;
}

export function ReviewForm({ onSubmit, revieweeId, revieweeName }: ReviewFormProps) {
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [comment, setComment] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (rating === 0) return;

        setIsSubmitting(true);
        try {
            await onSubmit(rating, comment);
            setRating(0);
            setComment("");
            setHoverRating(0);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Leave a Review</CardTitle>
                <CardDescription>
                    Share your experience with {revieweeName}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Rating
                        </label>
                        <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => setRating(star)}
                                    onMouseEnter={() => setHoverRating(star)}
                                    onMouseLeave={() => setHoverRating(0)}
                                    className="transition-transform hover:scale-110"
                                >
                                    <Star
                                        className={cn(
                                            "h-8 w-8",
                                            star <= (hoverRating || rating)
                                                ? "fill-yellow-400 text-yellow-400"
                                                : "fill-gray-200 text-gray-200"
                                        )}
                                    />
                                </button>
                            ))}
                            {rating > 0 && (
                                <span className="ml-2 text-sm text-gray-600">
                                    {rating} {rating === 1 ? "star" : "stars"}
                                </span>
                            )}
                        </div>
                    </div>

                    <div>
                        <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-2">
                            Comment (Optional)
                        </label>
                        <Textarea
                            id="comment"
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Share details about your experience..."
                            rows={4}
                            className="w-full"
                        />
                    </div>

                    <Button
                        type="submit"
                        disabled={rating === 0 || isSubmitting}
                        className="w-full"
                    >
                        {isSubmitting ? "Submitting..." : "Submit Review"}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
