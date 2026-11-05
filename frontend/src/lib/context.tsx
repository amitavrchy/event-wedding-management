"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { api } from "./api";
import { socket, disconnect } from "./socket";
import type { Event, User, Vendor } from "./types";
type AppState = {
  user: User | null;
  ready: boolean;
  events: Event[];
  event: Event | null;
  vendors: Vendor[];
  error: string;
  loading: boolean;
  refresh: () => Promise<void>;
  selectEvent: (id: string) => void;
  login: (token: string, user: User) => void;
  logout: () => void;
  notify: (message: string, error?: boolean) => void;
};
const Context = createContext<AppState | null>(null);
export function Provider({ children }: { children: React.ReactNode }) {
  const generation = useRef(0);
  const [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [events, setEvents] = useState<Event[]>([]),
    [event, setEvent] = useState<Event | null>(null),
    [vendors, setVendors] = useState<Vendor[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [selected, setSelected] = useState(""),
    [toast, setToast] = useState<{ message: string; error: boolean } | null>(
      null,
    );
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("utsab-user");
      if (saved && sessionStorage.getItem("utsab-token")) {
        const restored = JSON.parse(saved) as User;
        setUser(restored);
        setSelected(sessionStorage.getItem(`utsab-event-${restored.id}`) || "");
      }
    } catch {}
    setReady(true);
    const expire = () => {
      generation.current++;
      setUser(null);
      setEvent(null);
      setEvents([]);
    };
    window.addEventListener("utsab-expired", expire);
    return () => window.removeEventListener("utsab-expired", expire);
  }, []);
  const refresh = useCallback(async () => {
    if (!user) return;
    const request = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const [all, v] = await Promise.all([
        api<Event[]>("events"),
        api<Vendor[]>("vendors"),
      ]);
      const id = all.find((e) => e.id === selected)?.id || all[0]?.id;
      const detail = id ? await api<Event>(`events/${id}`) : null;
      if (request !== generation.current) return;
      setEvents(all);
      setVendors(v);
      setEvent(detail);
    } catch (e) {
      if (request === generation.current) setError((e as Error).message);
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [user, selected]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!user) return;
    const connection = socket();
    const update = () => void refresh();
    connection.on("booking:update", update);
    connection.connect();
    return () => {
      connection.off("booking:update", update);
      disconnect();
    };
  }, [user, refresh]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  function login(token: string, u: User) {
    sessionStorage.setItem("utsab-token", token);
    sessionStorage.setItem("utsab-user", JSON.stringify(u));
    setUser(u);
    setSelected(sessionStorage.getItem(`utsab-event-${u.id}`) || "");
  }
  function logout() {
    generation.current++;
    sessionStorage.removeItem("utsab-token");
    sessionStorage.removeItem("utsab-user");
    setUser(null);
    setEvents([]);
    setEvent(null);
  }
  const notify = useCallback(
    (message: string, error = false) => setToast({ message, error }),
    [],
  );
  return (
    <Context.Provider
      value={{
        user,
        ready,
        events,
        event,
        vendors,
        error,
        loading,
        refresh,
        selectEvent: (id) => {
          if (user) sessionStorage.setItem(`utsab-event-${user.id}`, id);
          setSelected(id);
        },
        login,
        logout,
        notify,
      }}
    >
      {children}
      {toast && (
        <div
          role={toast.error ? "alert" : "status"}
          className={`toast ${toast.error ? "toast-error" : ""}`}
        >
          {toast.message}
        </div>
      )}
    </Context.Provider>
  );
}
export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error("App provider missing");
  return value;
}
