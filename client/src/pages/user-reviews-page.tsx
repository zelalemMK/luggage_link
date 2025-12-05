import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ReviewForm } from "@/components/ui/review-form";
import { ReviewList } from "@/components/ui/review-list";
import { StarRating } from "@/components/ui/star-rating";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

export default function UserReviewsPage() {
    const [, params] = useRoute("/user/:userId/reviews");
    const userId = params?.userId ? parseInt(params.userId) : null;
    const { user: currentUser } = useAuth();
    const { toast } = useToast();

    const { data: user, isLoading: userLoading } = useQuery<any>({
        queryKey: [`/api/user/${userId}`],
        enabled: !!userId,
    });

    const { data: reviews, isLoading: reviewsLoading, refetch } = useQuery<any[]>({
        queryKey: [`/api/reviews/user/${userId}`],
        enabled: !!userId,
    });

    const handleSubmitReview = async (rating: number, comment: string) => {
        if (!userId || !currentUser) return;

        try {
            await apiRequest("POST", "/api/reviews", {
                revieweeId: userId,
                rating,
                comment: comment || null,
            });

            toast({
                title: "Review submitted",
                description: "Your review has been posted successfully",
            });

            refetch();
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to submit review. Please try again.",
                variant: "destructive",
            });
        }
    };

    if (userLoading || reviewsLoading) {
        return (
            <div className="min-h-screen flex flex-col">
                <Header />
                <main className="flex-grow flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
                </main>
                <Footer />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen flex flex-col">
                <Header />
                <main className="flex-grow flex items-center justify-center">
                    <p className="text-gray-500">User not found</p>
                </main>
                <Footer />
            </div>
        );
    }

    const getInitials = (firstName: string, lastName: string) => {
        return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    };

    const canReview = currentUser && currentUser.id !== userId;

    return (
        <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-grow bg-gray-50 py-8">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* User Profile Header */}
                    <Card className="mb-6">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <Avatar className="h-20 w-20">
                                    <AvatarImage src={user.profileImage || undefined} />
                                    <AvatarFallback className="bg-primary-500 text-white text-xl">
                                        {getInitials(user.firstName, user.lastName)}
                                    </AvatarFallback>
                                </Avatar>

                                <div className="flex-1">
                                    <h1 className="text-2xl font-bold text-gray-900">
                                        {user.firstName} {user.lastName}
                                    </h1>
                                    <div className="flex items-center gap-2 mt-1">
                                        <StarRating rating={user.rating || 0} reviewCount={user.reviewCount || 0} />
                                        {user.isVerified && (
                                            <Badge variant="outline" className="bg-green-100 text-green-800">
                                                <CheckCircle className="h-3 w-3 mr-1" />
                                                Verified
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Review Form - Only show if user is logged in and not viewing their own profile */}
                    {canReview && (
                        <div className="mb-6">
                            <ReviewForm
                                onSubmit={handleSubmitReview}
                                revieweeId={userId!}
                                revieweeName={`${user.firstName} ${user.lastName}`}
                            />
                        </div>
                    )}

                    {/* Reviews List */}
                    <Card>
                        <CardHeader>
                            <CardTitle>
                                Reviews ({reviews?.length || 0})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ReviewList
                                reviews={reviews || []}
                                emptyMessage={`${user.firstName} hasn't received any reviews yet`}
                            />
                        </CardContent>
                    </Card>
                </div>
            </main>
            <Footer />
        </div>
    );
}
