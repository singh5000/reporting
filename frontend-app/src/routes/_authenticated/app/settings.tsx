import { useState } from "react";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { AppShell } from "@/components/layout/AppShell";
import { SettingsTabs, type SettingsTabId } from "@/components/settings/SettingsTabs";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { PreferencesSettings } from "@/components/settings/PreferencesSettings";
import { SecuritySettings } from "@/components/settings/SecuritySettings";
import { NotificationsSettings } from "@/components/settings/NotificationsSettings";
import { DangerZone } from "@/components/settings/DangerZone";

const searchSchema = z.object({ tab: z.string().optional() });

export const Route = createFileRoute("/_authenticated/app/settings")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Settings · 360CRD" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { tab: tabParam } = useSearch({ from: "/_authenticated/app/settings" });
  const [tab, setTab] = useState<SettingsTabId>((tabParam as SettingsTabId) ?? "profile");

  return (
    <AppShell>
      <div className="mx-auto max-w-[1200px] space-y-6 animate-in fade-in duration-300">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your profile, preferences, security and notifications.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-[220px_1fr]">
          <aside className="md:sticky md:top-6 md:self-start">
            <SettingsTabs active={tab} onChange={setTab} />
          </aside>
          <section className="min-w-0">
            {tab === "profile"       && <ProfileSettings />}
            {tab === "preferences"   && <PreferencesSettings />}
            {tab === "security"      && <SecuritySettings />}
            {tab === "notifications" && <NotificationsSettings />}
            {tab === "danger"        && <DangerZone />}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
