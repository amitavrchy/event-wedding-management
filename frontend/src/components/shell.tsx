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
  Bell,
  BriefcaseBusiness,
  Heart,
  Armchair,
  Timer,
  QrCode,
  Globe,
  FileSignature,
  Receipt,
  Zap,
  Palette,
  BarChart3,
  UserRound,
  HandCoins,
  Home,
  Mail,
  Plane,
  UtensilsCrossed,
  Camera,
  Radio,
  CalendarSearch,
  Scale,
  Truck,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { useApp } from "@/lib/context";
import {
  featureForPath,
  hostNavigation,
  pathAllowed,
  vendorNavigation,
  basePath,
} from "@/lib/features";
import { AuthScreen } from "./auth-screen";
import { CommandMenu } from "./command-menu";
import { OccasionPicker } from "./occasion-picker";
import { FeatureOff } from "./feature-gate";
import "@/app/occasion.css";

const featureIcons: Record<string, LucideIcon> = {
  checklist: ListChecks,
  budget: Wallet,
  timeline: CalendarDays,
  datePlanner: CalendarSearch,
  costSplit: Scale,
  gifts: HandCoins,
  inspiration: Palette,
  guests: Users,
  sides: Heart,
  households: Home,
  invitations: Mail,
  seating: Armchair,
  logistics: Plane,
  checkIn: QrCode,
  vendors: Store,
  shortlist: Heart,
  bookings: CalendarDays,
  quotes: Gift,
  contracts: FileSignature,
  finance: Receipt,
  runSheet: Timer,
  vendorPortal: Truck,
  catering: UtensilsCrossed,
  photoWall: Camera,
  livestream: Radio,
  website: Globe,
  collaboration: Users,
  automations: Zap,
  insights: BarChart3,
};
const vendorIcons: Record<string, LucideIcon> = {
  "/business": BriefcaseBusiness,
  "/studio": Store,
  "/availability": CalendarDays,
  "/packages": Gift,
  "/bookings": CalendarDays,
  "/contracts": FileSignature,
  "/finance": Receipt,
  "/insights": BarChart3,
};
const pageTitles: Record<string, string> = {
  "/dashboard": "Overview",
  "/planning": "Planning studio",
  "/messages": "Messages",
  "/settings": "Event settings",
  "/account": "Account & security",
  "/notifications": "Reminders",
  "/admin": "Administration",
  "/business": "Leads & pipeline",
  "/studio": "Profile & services",
  "/availability": "Calendar",
};

export function Shell({ children }: { children: React.ReactNode }) {
  const {
    user,
    ready,
    event,
    events,
    selectEvent,
    logout,
    error,
    refresh,
    catalog,
    loading,
  } = useApp();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
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
  const isVendor = user.role === "VENDOR";
  const isAdmin = user.role === "PLATFORM_ADMIN";
  const locale = user.locale === "bn" ? "bn" : "en";
  const groups = isVendor ? [] : hostNavigation(event, catalog, locale);
  // A host with no event starts by choosing the occasion.
  const needsOccasion =
    !isVendor && !isAdmin && !loading && !error && events.length === 0;
  const current = featureForPath(path, catalog);
  const allowed = pathAllowed(path, user, event, catalog);
  const isActive = (target: string) => basePath(target) === path;
  const close = () => setOpen(false);
  const title = current?.label || pageTitles[path] || "Your workspace";
  return (
    <div className="app-layout">
      {open && (
        <button
          className="mobile-scrim"
          aria-label="Close menu"
          onClick={close}
        />
      )}
      <aside className={`sidebar ${open ? "is-open" : ""}`}>
        <Link className="brand" href="/">
          utsab<span>✳</span>
        </Link>
        {!isVendor && (
          <div className="workspace-select">
            <span className="event-avatar">
              {event?.title.charAt(0) || "✧"}
            </span>
            <div>
              <span className="micro-label">YOUR CELEBRATION</span>
              <select
                aria-label="Choose event"
                value={event?.id || ""}
                onChange={(e) =>
                  e.target.value === "__new"
                    ? setPicking(true)
                    : selectEvent(e.target.value)
                }
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
                <option value="__new">+ Plan another occasion</option>
              </select>
            </div>
            <ChevronDown size={16} />
          </div>
        )}
        <nav aria-label="Workspace">
          <Link
            onClick={close}
            href={isVendor ? "/business" : "/dashboard"}
            className={`nav-item ${isActive(isVendor ? "/business" : "/dashboard") ? "active" : ""}`}
          >
            <LayoutDashboard size={20} />
            <span>{isVendor ? "Business overview" : "Overview"}</span>
          </Link>
          {groups.map((group) => (
            <div key={group.key} className="nav-group">
              <span className="nav-section nav-group-label">
                {group.label.toUpperCase()}
              </span>
              {group.items.map((item) => {
                const Icon = featureIcons[item.key] || Sparkles;
                return (
                  <Link
                    onClick={close}
                    key={item.key}
                    href={item.path}
                    className={`nav-item ${isActive(item.path) && item.path === basePath(item.path) ? "active" : ""}`}
                  >
                    <Icon size={20} />
                    <span>{locale === "bn" ? item.labelBn : item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
          {isVendor &&
            vendorNavigation
              .filter((item) => item.path !== "/business")
              .map((item) => {
                const Icon = vendorIcons[item.path] || Store;
                return (
                  <Link
                    onClick={close}
                    key={item.path}
                    href={item.path}
                    className={`nav-item ${isActive(item.path) ? "active" : ""}`}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
          <Link
            onClick={close}
            href="/messages"
            className={`nav-item ${isActive("/messages") ? "active" : ""}`}
          >
            <MessagesSquare size={20} />
            <span>Messages</span>
          </Link>
          {isAdmin && (
            <Link
              onClick={close}
              href="/admin"
              className={`nav-item ${isActive("/admin") ? "active" : ""}`}
            >
              <ShieldCheck size={20} />
              <span>Administration</span>
            </Link>
          )}
        </nav>
        <div className="sidebar-bottom">
          {!isVendor && (
            <>
              <button className="nav-item" onClick={() => setPicking(true)}>
                <Plus size={20} />
                Plan another occasion
              </button>
              <Link
                onClick={close}
                className={`nav-item ${isActive("/settings") ? "active" : ""}`}
                href="/settings"
              >
                <Settings size={20} />
                Event settings & tools
              </Link>
            </>
          )}
          <Link
            onClick={close}
            className={`nav-item ${isActive("/account") ? "active" : ""}`}
            href="/account"
          >
            <UserRound size={20} />
            Account & security
          </Link>
          <button onClick={() => void logout()} className="nav-item">
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
            <span>
              {isVendor ? "Your business" : event?.title || "Your workspace"}
            </span>
            <span className="breadcrumb-slash">/</span>
            <strong>{title}</strong>
          </div>
          <div className="topbar-actions">
            <CommandMenu />
            <span className="topbar-separator" />
            <Link
              href="/notifications"
              className="icon-button"
              aria-label="Notifications"
            >
              <Bell size={20} />
            </Link>
            <Link href="/account" className="user-avatar" aria-label="Account">
              {user.fullName
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </Link>
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
          {user.emailVerified === false && path !== "/account" && (
            <div className="info-note">
              <Mail size={19} />
              <span>
                Confirm your email so we can send booking updates and password
                resets. <Link href="/account">Enter your code</Link>
              </span>
            </div>
          )}
          {event?.access === "VIEWER" && (
            <div className="info-note">
              <ShieldCheck size={19} />
              <span>
                You have read-only access to this celebration. Planning changes
                need an editor invitation from the host.
              </span>
            </div>
          )}
          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              <button onClick={() => void refresh()}>Try again</button>
            </div>
          )}
          {!allowed && current ? <FeatureOff feature={current} /> : children}
        </main>
        <footer className="app-footer">
          <span>Thoughtfully planned. Beautifully celebrated.</span>
          <span>utsab ✳ · Bangladesh</span>
        </footer>
      </div>
      {(picking || needsOccasion) && (
        <OccasionPicker
          dismissible={!needsOccasion}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}
