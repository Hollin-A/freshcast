"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function SettingsRow({
  icon,
  color,
  label,
  detail,
  last,
  action,
}: {
  icon: string;
  color: string;
  label: string;
  detail?: string;
  last?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className={`flex items-center gap-3 px-3.5 py-3.5 ${last ? "" : "border-b border-line"}`}>
      <div
        className="flex h-[30px] w-[30px] items-center justify-center rounded-lg text-sm"
        style={{ background: color, color: "#FFF8EC" }}
      >
        {icon}
      </div>
      <span className="flex-1 text-[15px] text-ink">{label}</span>
      {detail && <span className="text-sm text-muted-warm">{detail}</span>}
      {action}
      {!action && <span className="text-mute2">›</span>}
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
  weeklyEmailEnabled,
}: {
  userName: string;
  userEmail: string;
  emailVerified: boolean;
  businessName: string;
  businessType: string;
  timezone: string;
  region: string;
  weeklyEmailEnabled: boolean;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [weeklyEmail, setWeeklyEmail] = useState(weeklyEmailEnabled);

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
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-warm">Settings</p>
        <h1 className="mt-1 font-serif text-[32px] font-medium tracking-tight text-ink">{businessName}</h1>
      </div>

      {/* Business card */}
      <div className="mx-4 mb-4 flex items-center gap-3.5 rounded-2xl bg-ink p-4.5 text-cream">
        <div className="flex h-[50px] w-[50px] items-center justify-center rounded-xl bg-terra font-serif text-[22px] font-semibold">
          {(userName[0] || "U").toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-serif text-lg font-medium">{userName}</p>
          <p className="text-[13px] text-cream/60">{userEmail} · {typeLabel} · {timezoneCity}</p>
        </div>
        {emailVerified && <Badge variant="gold">Verified</Badge>}
      </div>

      {/* Email verification */}
      {!emailVerified && (
        <div className="mx-4 mb-4 rounded-2xl border border-harvest/30 bg-harvest/8 p-3.5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink">Email not verified</p>
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
      <p className="mx-5 mb-2.5 mt-4 text-[11px] font-bold uppercase tracking-wider text-muted-warm">Business</p>
      <div className="mx-4 overflow-hidden rounded-2xl border border-line bg-paper">
        <SettingsRow icon="🏪" color="#B5553A" label="Business name" detail={businessName} />
        <SettingsRow icon="🗓" color="#6B7A3A" label="Timezone" detail={timezoneCity} />
        <SettingsRow icon="🎯" color="#6E3A4A" label="Holiday region" detail={region} />
        <SettingsRow icon="🌐" color="#C69840" label="Language" detail="English" last />
      </div>

      {/* Forecast */}
      <p className="mx-5 mb-2.5 mt-6 text-[11px] font-bold uppercase tracking-wider text-muted-warm">Forecast</p>
      <div className="mx-4 overflow-hidden rounded-2xl border border-line bg-paper">
        <div className="flex items-center gap-3 px-3.5 py-3.5">
          <div className="flex h-[30px] w-[30px] items-center justify-center rounded-lg text-sm" style={{ background: "#B5553A", color: "#FFF8EC" }}>📬</div>
          <span className="flex-1 text-[15px] text-ink">Weekly summary email</span>
          <button
            onClick={async () => {
              const next = !weeklyEmail;
              setWeeklyEmail(next);
              try {
                await fetch("/api/business", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ weeklyEmailEnabled: next }),
                });
              } catch {
                setWeeklyEmail(!next);
              }
            }}
            className="flex h-[26px] w-[44px] items-center rounded-full p-0.5 transition-colors"
            style={{ background: weeklyEmail ? "#6B7A3A" : "#E4D9C1", justifyContent: weeklyEmail ? "flex-end" : "flex-start" }}
            aria-label="Toggle weekly email"
          >
            <div className="h-[22px] w-[22px] rounded-full bg-white shadow-sm" />
          </button>
        </div>
      </div>

      {/* Data */}
      <p className="mx-5 mb-2.5 mt-6 text-[11px] font-bold uppercase tracking-wider text-muted-warm">Data</p>
      <div className="mx-4 overflow-hidden rounded-2xl border border-line bg-paper">
        <SettingsRow
          icon="⬇"
          color="#7A6F5E"
          label="Export sales as CSV"
          action={
            <button
              onClick={() => window.open("/api/sales/export", "_blank")}
              className="text-sm font-semibold text-terra"
            >
              Export
            </button>
          }
        />
        <SettingsRow icon="🗑" color="#B5553A" label="Delete all data" last action={
          <button
            onClick={handleDeleteAccount}
            disabled={isDeleting}
            className="text-sm font-semibold text-terra"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        } />
      </div>

      <p className="mx-10 mt-6 text-center font-serif text-[13px] italic leading-relaxed text-muted-warm">
        Your data is private.<br />Freshcast only works for your business.
      </p>

      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="mx-auto mt-4 block text-center text-[13px] font-semibold text-terra"
      >
        Log out
      </button>
    </>
  );
}
