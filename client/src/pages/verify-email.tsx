import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Mail } from "lucide-react";

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="max-w-md w-full text-center p-6">
        <CardHeader>
          <Mail className="mx-auto h-12 w-12 text-primary-500" />
          <CardTitle className="mt-4 text-2xl font-semibold">Verify Your Email</CardTitle>
          <CardDescription className="mt-2 text-gray-600">
            We’ve sent a verification link to your email. Please check your inbox and click the link to activate your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="mt-6">
          <p className="text-sm text-gray-500 mb-4">
            Didn’t receive the email? Check your spam folder or request a new verification link.
          </p>
          <Button className="w-full mb-3" variant="outline">
            Resend Verification Email
          </Button>
          <Link href="/login">
            <Button className="w-full">Back to Login</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
