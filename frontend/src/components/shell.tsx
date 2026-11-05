"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Store,
  CalendarDays,
  Wallet,
  Users,
  ListChecks,
  Gift,
  MessagesSquare,
  Settings,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Sparkles,
  ShieldCheck,
  Search,
  Bell,
} from "lucide-react";
import { useApp } from "@/lib/context";
import { AuthScreen } from "./auth-screen";
const navigation = [
  ["/", "Overview", LayoutDashboard],
  ["/vendors", "Find vendors", Store],
  ["/bookings", "My bookings", CalendarDays],
  ["/budget", "Budget planner", Wallet],
  ["/guests", "Guest list", Users],
  ["/checklist", "Checklist", ListChecks],
  ["/packages", "Packages & quotes", Gift],
  ["/messages", "Messages", MessagesSquare],
] as const;
export function Shell({ children }: { children: React.ReactNode }) {
  const { user, ready, event, events, selectEvent, logout, error, refresh } =
    useApp();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  if (!ready)
    return (
      <div className="boot">
        <span className="brand">
          utsab<span>✳</span>
        </span>
        <p>Making room for your moments…</p>
      </div>
    );
  if (!user) return <AuthScreen />;
  return (
    <div className="app-layout">
      {open && (
        <button
          className="mobile-scrim"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={`sidebar ${open ? "is-open" : ""}`}>
        <Link className="brand" href="/">
          utsab<span>✳</span>
        </Link>
        <div className="workspace-select">
          <span className="event-avatar">{event?.title.charAt(0) || "✧"}</span>
          <div>
            <span className="micro-label">YOUR CELEBRATION</span>
            <select
              aria-label="Choose event"
              value={event?.id || ""}
              onChange={(e) => selectEvent(e.target.value)}
            >
              {events.length ? (
                events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title}
                  </option>
                ))
              ) : (
                <option value="">Create an event</option>
              )}
            </select>
          </div>
          <ChevronDown size={16} />
        </div>
        <span className="nav-section">YOUR WORKSPACE</span>
        <nav>
          {navigation.map(([url, label, Icon]) => (
            <Link
              onClick={() => setOpen(false)}
              key={url}
              href={url}
              className={`nav-item ${path === url ? "active" : ""}`}
            >
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          ))}
          {user.role === "VENDOR" && (
            <Link
              href="/studio"
              className={`nav-item ${path === "/studio" ? "active" : ""}`}
            >
              <Store size={20} />
              Vendor studio
            </Link>
          )}
          {user.role === "PLATFORM_ADMIN" && (
            <Link href="/admin" className="nav-item">
              <ShieldCheck size={20} />
              Administration
            </Link>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Sparkles size={24} />
            <h3>A little help, a lot of joy.</h3>
            <p>
              Your whole celebration,
              <br />
              beautifully organized.
            </p>
            <Link href="/checklist">
              See your next steps <span>↗</span>
            </Link>
          </div>
          <Link
            className={`nav-item ${path === "/settings" ? "active" : ""}`}
            href="/settings"
          >
            <Settings size={20} />
            Event settings
          </Link>
          <button onClick={logout} className="nav-item">
            <LogOut size={20} />
            Sign out
          </button>
          <p className="sidebar-credit">MADE FOR YOUR MOMENTS.</p>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              aria-label={open ? "Close navigation" : "Open navigation"}
              onClick={() => setOpen(!open)}
              className="mobile-menu icon-button"
            >
              {open ? <X /> : <Menu />}
            </button>
            <span>Your workspace</span>
            <span className="breadcrumb-slash">/</span>
            <strong>
              {navigation.find(([url]) => url === path)?.[1] || "Settings"}
            </strong>
          </div>
          <div className="topbar-actions">
            <Link href="/vendors" className="top-search">
              <Search size={17} />
              <span>Find something lovely</span>
            </Link>
            <span className="topbar-separator" />
            <Link
              href="/notifications"
              className="icon-button"
              aria-label="Planning reminders"
            >
              <Bell size={20} />
            </Link>
            <div className="user-avatar">
              {user.fullName
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </div>
            <div className="topbar-user">
              <strong>{user.fullName}</strong>
              <span>
                {user.role === "HOST"
                  ? "Making memories"
                  : user.role.toLowerCase().replace("_", " ")}
              </span>
            </div>
          </div>
        </header>
        <main className="main-content">
          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              <button onClick={() => void refresh()}>Try again</button>
            </div>
          )}
          {children}
        </main>
        <footer className="app-footer">
          <span>Thoughtfully planned. Beautifully celebrated.</span>
          <span>utsab ✳ · Bangladesh</span>
        </footer>
      </div>
    </div>
  );
}
