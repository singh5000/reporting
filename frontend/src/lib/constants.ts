import {
  Activity,
  Building2,
  ClipboardCheck,
  LayoutDashboard,
  type LucideIcon,
  Settings,
  ShieldAlert,
  Warehouse,
  Users,
} from "lucide-react";

export type NavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
};

export const APP_NAME = "360CRD";
export const APP_TAGLINE = "Audit & Compliance Platform";

export const navItems: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Audits", to: "/audits", icon: ClipboardCheck },
  { label: "Incidents", to: "/incidents", icon: ShieldAlert },
  { label: "Facilities", to: "/facilities", icon: Warehouse },
  { label: "Companies", to: "/companies", icon: Building2 },
  { label: "Activity", to: "/activity", icon: Activity },
  { label: "Settings", to: "/settings", icon: Settings },
];

export const adminNavItems: NavItem[] = [
  { label: "Team", to: "/team", icon: Users },
];
