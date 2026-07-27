"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AnalyticsIcon, BellIcon, FlameIcon, LogoIcon, LogoutIcon,
  ProblemsIcon, SettingsIcon, TodayIcon,
} from "./icons";
import { signOut } from "@/app/auth/actions";

const navItems = [
  { href: "/today", label: "Today", icon: TodayIcon },
  { href: "/problems", label: "Problems", icon: ProblemsIcon },
  { href: "/analytics", label: "Analytics", icon: AnalyticsIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export function AppShell({
  children,
  displayName,
  email,
}: {
  children: React.ReactNode;
  displayName: string;
  email: string;
}) {
  const pathname = usePathname();
  const initials = displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <Link href="/today" className="brand sidebar-brand"><span><LogoIcon /></span>stride</Link>
        <nav>
          <small>WORKSPACE</small>
          {navItems.map(({ href, label, icon: NavIcon }) => (
            <Link href={href} className={pathname.startsWith(href) ? "active" : ""} key={href}>
              <NavIcon /><span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-streak">
          <span><FlameIcon /></span>
          <div><strong>Start your streak</strong><small>Complete one problem today</small></div>
        </div>
        <form action={signOut} className="sidebar-user">
          <span className="avatar">{initials || "DS"}</span>
          <span><strong>{displayName}</strong><small>{email}</small></span>
          <button aria-label="Sign out" title="Sign out"><LogoutIcon /></button>
        </form>
      </aside>
      <div className="mobile-top">
        <Link href="/today" className="brand"><span><LogoIcon /></span>stride</Link>
        <button aria-label="Notifications"><BellIcon /></button>
      </div>
      <div className="app-main">
        <header className="app-topbar">
          <span className="connection"><i /> Cloud sync active</span>
          <div><button aria-label="Notifications"><BellIcon /></button><span className="avatar small">{initials || "DS"}</span></div>
        </header>
        <main>{children}</main>
      </div>
      <nav className="mobile-nav">
        {navItems.map(({ href, label, icon: NavIcon }) => (
          <Link href={href} className={pathname.startsWith(href) ? "active" : ""} key={href}><NavIcon /><span>{label}</span></Link>
        ))}
      </nav>
    </div>
  );
}
