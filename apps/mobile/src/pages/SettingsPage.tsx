import { useAuth } from "../lib/auth";

export default function SettingsPage() {
  const { user, signOut } = useAuth();

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-6">Settings</h1>

      {/* User info */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <h2 className="text-sm font-medium text-gray-500 mb-2">Account</h2>
        <p className="font-medium">{user?.getUsername() || "—"}</p>
      </div>

      {/* App info */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <h2 className="text-sm font-medium text-gray-500 mb-2">App Version</h2>
        <p>0.1.0</p>
      </div>

      {/* Sign out */}
      <button
        onClick={signOut}
        className="w-full py-3 bg-red-50 text-red-600 rounded-lg font-medium"
      >
        Sign Out
      </button>
    </div>
  );
}
