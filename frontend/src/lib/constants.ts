import {
  Activity,
  AlertTriangle,
  Archive,
  BookOpen,
  Building2,
  ClipboardCheck,
  FileText,
  GraduationCap,
  HardHat,
  LayoutDashboard,
  type LucideIcon,
  Package,
  Recycle,
  Settings,
  ShieldAlert,
  Users,
  Warehouse,
  Webhook,
  Bell,
} from "lucide-react";

export type NavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
  permission?: string;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const APP_NAME = "360CRD";
export const APP_TAGLINE = "EHS & Compliance Platform";

export const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
      { label: "Activity", to: "/activity", icon: Activity },
    ],
  },
  {
    label: "Safety",
    items: [
      { label: "Incidents", to: "/incidents", icon: ShieldAlert, permission: "incident:read" },
      { label: "Audits", to: "/audits", icon: ClipboardCheck, permission: "audit:read" },
      { label: "PPE", to: "/ppe", icon: HardHat, permission: "ppe:read" },
    ],
  },
  {
    label: "Compliance",
    items: [
      { label: "Training", to: "/training", icon: GraduationCap, permission: "training:read" },
      { label: "Inductions", to: "/inductions", icon: BookOpen, permission: "induction:read" },
      { label: "Documents", to: "/documents", icon: FileText, permission: "document:read" },
      { label: "Waste", to: "/waste", icon: Recycle, permission: "waste:read" },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Assets", to: "/assets", icon: Package, permission: "asset:read" },
      { label: "Sites", to: "/facilities", icon: Warehouse, permission: "site:read" },
      { label: "Customers", to: "/companies", icon: Building2, permission: "customer:read" },
    ],
  },
  {
    label: "Management",
    items: [
      { label: "Reports", to: "/reports", icon: Archive, permission: "report:read" },
      { label: "Notifications", to: "/notifications", icon: Bell },
      { label: "Team", to: "/users", icon: Users, permission: "user:read" },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Roles", to: "/roles", icon: ShieldAlert, permission: "role:read" },
      { label: "Webhooks", to: "/webhooks", icon: Webhook, permission: "webhook:read" },
      { label: "Settings", to: "/settings", icon: Settings },
    ],
  },
];

export const navItems: NavItem[] = navGroups.flatMap((g) => g.items);

export const adminNavItems: NavItem[] = [
  { label: "Team", to: "/users", icon: Users },
];
