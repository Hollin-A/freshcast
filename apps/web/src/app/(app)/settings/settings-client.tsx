"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function SettingsRow({
  icon,
  tone,
  label,
  detail,
  last,
  action,
}: {
  icon: string;
  /** Background class for the icon tile, e.g. bg-chart-1 */
  tone: string;
  label: string;
  detail?: string;
  last?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className={`flex items-center gap-3 px-3.5 py-3.5 ${last ? "" : "border-b border-border"}`}>
      <div
        className={`flex h-[30px] w-[30px] items-center justify-center rounded-lg text-sm text-primary-foreground ${tone}`}
      >
        {icon}
      </div>
      <span className="flex-1 text-[15px] text-foreground">{label}</span>
      {detail && <span className="text-sm text-muted-foreground">{detail}</span>}
      {action}
      {!action && <span className="text-faint-foreground">›</span>}
    </div>
  );
}

export function SettingsClient({
  userName,
  userEmail,
  emailVerified,
  businessName,
  businessType,
  timezone,
  region,
}: {
  userName: string;
  userEmail: string;
  emailVerified: boolean;
  businessName: string;
  businessType: string;
  timezone: string;
  region: string;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);

  async function handleDeleteAccount() {
    const confirmed = confirm(
      "Are you sure you want to delete your account? This will permanently delete all your business data, sales history, and insights. This cannot be undone."
    );
    if (!confirmed) return;

    const doubleConfirm = confirm(
      "This is your last chance. Are you absolutely sure?"
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

  const timezoneCity = timezone.split("/").pop()?.replace(/_/g, " ") || timezone;
  const typeLabel = businessType.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

  return (
    <>
      <div className="px-5 pt-14 pb-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Settings</p>
        <h1 className="mt-1 font-serif text-[32px] font-medium tracking-tight text-foreground">{businessName}</h1>
      </div>

      {/* Business card */}
      <div className="mx-4 mb-4 flex items-center gap-3.5 rounded-2xl bg-inverse p-4.5 text-inverse-foreground">
        <div className="flex h-[50px] w-[50px] items-center justify-center rounded-xl bg-primary font-serif text-[22px] font-semibold">
          {(userName[0] || "U").toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-serif text-lg font-medium">{userName}</p>
          <p className="text-[13px] text-inverse-foreground/60">{userEmail} · {typeLabel} · {timezoneCity}</p>
        </div>
        {emailVerified && <Badge variant="warning">Verified</Badge>}
      </div>

      {/* Email verification */}
      {!emailVerified && (
        <div className="mx-4 mb-4 rounded-2xl border border-warning/30 bg-warning/8 p-3.5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-foreground">Email not verified</p>
            <Button
              variant="secondary"
              size="sm"
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
          </div>
        </div>
      )}

      {/* Business settings */}
      <p className="mx-5 mb-2.5 mt-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Business</p>
      <div className="mx-4 overflow-hidden rounded-2xl border border-border bg-card">
        <SettingsRow icon="🏪" tone="bg-chart-1" label="Business name" detail={businessName} />
        <SettingsRow icon="🗓" tone="bg-chart-2" label="Timezone" detail={timezoneCity} />
        <SettingsRow icon="🎯" tone="bg-chart-5" label="Holiday region" detail={region} />
        <SettingsRow icon="🌐" tone="bg-chart-3" label="Language" detail="English" last />
      </div>

      {/* Weekly summary email: paused until it's rebuilt in Stage 4f (#42). */}

      {/* Data */}
      <p className="mx-5 mb-2.5 mt-6 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Data</p>
      <div className="mx-4 overflow-hidden rounded-2xl border border-border bg-card">
        <SettingsRow
          icon="⬇"
          tone="bg-muted-foreground"
          label="Export sales as CSV"
          action={
            <button
              onClick={() => window.open("/api/sales/export", "_blank")}
              className="text-sm font-semibold text-primary"
            >
              Export
            </button>
          }
        />
        <SettingsRow icon="🗑" tone="bg-destructive" label="Delete all data" last action={
          <button
            onClick={handleDeleteAccount}
            disabled={isDeleting}
            className="text-sm font-semibold text-destructive"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        } />
      </div>

      <p className="mx-10 mt-6 text-center font-serif text-[13px] italic leading-relaxed text-muted-foreground">
        Your data is private.<br />Freshcast only works for your business.
      </p>

      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="mx-auto mt-4 block text-center text-[13px] font-semibold text-primary"
      >
        Log out
      </button>
    </>
  );
}
