export default function SettingsPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="text-sm text-muted-foreground">
        V1 settings are managed through environment variables and seeded admin users. Operational dropdowns use frontend constants.
      </p>
    </div>
  );
}
