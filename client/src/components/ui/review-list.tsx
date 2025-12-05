import { StarRating } from "@/components/ui/star-rating";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";

interface Review {
    id: number;
    rating: number;
    comment: string | null;
    createdAt: string;
    reviewer: {
        id: number;
        firstName: string;
        lastName: string;
        profileImage: string | null;
    } | null;
}

interface ReviewListProps {
    reviews: Review[];
    emptyMessage?: string;
}

export function ReviewList({ reviews, emptyMessage = "No reviews yet" }: ReviewListProps) {
    if (reviews.length === 0) {
        return (
            <div className="text-center py-12 text-gray-500">
                <p>{emptyMessage}</p>
            </div>
        );
    }

    const getInitials = (firstName: string, lastName: string) => {
        return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    };

    return (
        <div className="space-y-4">
            {reviews.map((review) => (
                <Card key={review.id}>
                    <CardContent className="pt-6">
                        <div className="flex items-start gap-4">
                            <Avatar>
                                <AvatarImage src={review.reviewer?.profileImage || undefined} />
                                <AvatarFallback className="bg-primary-500 text-white">
                                    {review.reviewer
                                        ? getInitials(review.reviewer.firstName, review.reviewer.lastName)
                                        : "?"}
                                </AvatarFallback>
                            </Avatar>

                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-2">
                                    <div>
                                        <p className="font-medium text-gray-900">
                                            {review.reviewer
                                                ? `${review.reviewer.firstName} ${review.reviewer.lastName}`
                                                : "Anonymous"}
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
                                        </p>
                                    </div>
                                    <StarRating rating={review.rating} showCount={false} />
                                </div>

                                {review.comment && (
                                    <p className="text-gray-700 mt-2">{review.comment}</p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
