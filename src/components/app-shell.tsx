"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import {
  AnalyticsIcon, BellIcon, FlameIcon, LogoIcon, LogoutIcon,
  PlansIcon, ProblemsIcon, SettingsIcon, TodayIcon, TodosIcon,
} from "./icons";
import { signOut } from "@/app/auth/actions";
import type { Reminder } from "@/lib/analytics";
import { ThemeMenu } from "./theme-control";

const navItems = [
  { href: "/today", label: "Today", icon: TodayIcon },
  { href: "/todos", label: "Todos", icon: TodosIcon },
  { href: "/plans", label: "Plans", icon: PlansIcon },
  { href: "/problems", label: "Questions", icon: ProblemsIcon },
  { href: "/analytics", label: "Analytics", icon: AnalyticsIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export function AppShell({
  children,
  displayName,
  email,
  reminders,
}: {
  children: React.ReactNode;
  displayName: string;
  email: string;
  reminders: Reminder[];
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
            <Link href={href} className={pathname.startsWith(href) ? "active" : ""} aria-current={pathname.startsWith(href) ? "page" : undefined} key={href}>
              <NavIcon /><NavLabel label={label} />
            </Link>
          ))}
        </nav>
        <Link href="/today" className="sidebar-streak">
          <span><FlameIcon /></span>
          <div><strong>{reminders.some((item) => item.kind === "streak") ? "Protect your streak" : "Build your streak"}</strong><small>{reminders.find((item) => item.kind === "target")?.detail ?? "Today’s target is complete"}</small></div>
        </Link>
        <form action={signOut} className="sidebar-user">
          <span className="avatar">{initials || "DS"}</span>
          <span><strong title={displayName}>{displayName}</strong><small title={email}>{email}</small></span>
          <button aria-label="Sign out" title="Sign out"><LogoutIcon /></button>
        </form>
      </aside>
      <div className="mobile-top">
        <Link href="/today" className="brand"><span><LogoIcon /></span>stride</Link>
        <div><ThemeMenu /><ReminderMenu reminders={reminders} /></div>
      </div>
      <div className="app-main">
        <header className="app-topbar">
          <span className="connection"><i /> Cloud sync active</span>
          <div><ThemeMenu /><ReminderMenu reminders={reminders} /><span className="avatar small" aria-label={`Signed in as ${displayName}`}>{initials || "DS"}</span></div>
        </header>
        <main>{children}</main>
      </div>
      <nav className="mobile-nav">
        {navItems.map(({ href, label, icon: NavIcon }) => (
          <Link href={href} className={pathname.startsWith(href) ? "active" : ""} aria-current={pathname.startsWith(href) ? "page" : undefined} key={href}><NavIcon /><NavLabel label={label} /></Link>
        ))}
      </nav>
    </div>
  );
}

function NavLabel({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  return <span className="nav-label">{label}{pending && <i className="route-pending" aria-label={`Loading ${label}`} />}</span>;
}

function ReminderMenu({ reminders }: { reminders: Reminder[] }) {
  return <details className="reminder-menu">
    <summary aria-label={`${reminders.length} reminders`} title="Reminders"><BellIcon />{reminders.length > 0 && <span>{reminders.length}</span>}</summary>
    <div className="reminder-popover">
      <header><b>Reminders</b><small>{reminders.length ? `${reminders.length} need attention` : "You’re all caught up"}</small></header>
      {reminders.map((reminder) => <Link href={reminder.href} key={reminder.kind}><i data-kind={reminder.kind} /><span><b>{reminder.title}</b><small>{reminder.detail}</small></span></Link>)}
      {!reminders.length && <p>Nothing urgent. Keep your practice rhythm going.</p>}
    </div>
  </details>;
}
