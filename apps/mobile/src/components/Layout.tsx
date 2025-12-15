import { NavLink } from "react-router-dom";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Main content area */}
      <main className="flex-1 overflow-auto safe-area-top">{children}</main>

      {/* Bottom tab bar */}
      <nav className="flex border-t border-gray-200 bg-white safe-area-bottom">
        <TabLink to="/incidents" icon="🔔" label="Incidents" />
        <TabLink to="/schedule" icon="📅" label="Schedule" />
        <TabLink to="/team" icon="👥" label="Team" />
        <TabLink to="/settings" icon="⚙️" label="Settings" />
      </nav>
    </div>
  );
}

interface TabLinkProps {
  to: string;
  icon: string;
  label: string;
}

function TabLink({ to, icon, label }: TabLinkProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex-1 flex flex-col items-center py-2 text-xs ${
          isActive ? "text-blue-600" : "text-gray-500"
        }`
      }
    >
      <span className="text-xl mb-0.5">{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
}
