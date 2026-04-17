"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export function SettingsClient({
  userName,
  userEmail,
  emailVerified,
  businessName,
  businessType,
  timezone,
}: {
  userName: string;
  userEmail: string;
  emailVerified: boolean;
  businessName: string;
  businessType: string;
  timezone: string;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);

  async function handleDeleteAccount() {
    const confirmed = confirm(
      "Are you sure you want to delete your account? This will permanently delete all your business data, sales history, and insights. This cannot be undone."
    );
    if (!confirmed) return;

    const doubleConfirm = confirm(
      "This is your last chance. Type OK to confirm you want to delete everything."
    );
    if (!doubleConfirm) return;

    setIsDeleting(true);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) {
        toast.error("Failed to delete account");
        return;
      }
      toast.success("Account deleted");
      signOut({ callbackUrl: "/login" });
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name</span>
            <span>{userName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span>{userEmail}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Verification</span>
            {emailVerified ? (
              <span className="text-sm text-primary">✓ Verified</span>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={sendingVerification}
                onClick={async () => {
                  setSendingVerification(true);
                  try {
                    await fetch("/api/auth/send-verification", { method: "POST" });
                    toast.success("Verification email sent");
                  } catch {
                    toast.error("Failed to send");
                  } finally {
                    setSendingVerification(false);
                  }
                }}
              >
                {sendingVerification ? "Sending..." : "Verify email"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Business</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name</span>
            <span>{businessName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Type</span>
            <span>{businessType.replace(/_/g, " ").toLowerCase()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Timezone</span>
            <span>{timezone}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardContent className="py-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            Log out
          </Button>
        </CardContent>
      </Card>

      <Separator className="my-6" />

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Permanently delete your account and all associated data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            className="w-full"
            onClick={handleDeleteAccount}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete my account"}
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
