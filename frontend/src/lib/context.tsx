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
import type { Event, FeatureCatalog, User, Vendor } from "./types";
type AppState = {
  user: User | null;
  ready: boolean;
  events: Event[];
  event: Event | null;
  vendors: Vendor[];
  catalog: FeatureCatalog | null;
  error: string;
  loading: boolean;
  refresh: () => Promise<void>;
  selectEvent: (id: string) => void;
  login: (user: User) => void;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  notify: (message: string, error?: boolean) => void;
};
const eventKey = (userId: string) => `utsab-event-${userId}`;
function remembered(userId: string) {
  try {
    return localStorage.getItem(eventKey(userId)) || "";
  } catch {
    return "";
  }
}
const Context = createContext<AppState | null>(null);
export function Provider({ children }: { children: React.ReactNode }) {
  const generation = useRef(0);
  const [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [events, setEvents] = useState<Event[]>([]),
    [event, setEvent] = useState<Event | null>(null),
    [vendors, setVendors] = useState<Vendor[]>([]),
    [catalog, setCatalog] = useState<FeatureCatalog | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [selected, setSelected] = useState(""),
    [toast, setToast] = useState<{ message: string; error: boolean } | null>(
      null,
    );
  useEffect(() => {
    // The session is an httpOnly cookie; ask the API who we are.
    api<User>("auth/me")
      .catch(async () => {
        const refreshed = await api<{ user: User }>("auth/refresh", {
          method: "POST",
          body: "{}",
        });
        return refreshed.user;
      })
      .then((restored) => {
        setUser(restored);
        setSelected(remembered(restored.id));
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
    api<FeatureCatalog>("features")
      .then(setCatalog)
      .catch(() => undefined);
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
      const all = await api<Event[]>("events");
      const id = all.find((e) => e.id === selected)?.id || all[0]?.id;
      const detail = id ? await api<Event>(`events/${id}`) : null;
      if (request !== generation.current) return;
      setEvents(all);
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
  // The marketplace list does not change with planning edits; load it once per session.
  useEffect(() => {
    if (!user) return;
    api<Vendor[] | { items: Vendor[] }>("vendors?limit=24")
      .then((v) => setVendors(Array.isArray(v) ? v : v.items))
      .catch(() => undefined);
  }, [user]);
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
  function login(u: User) {
    setUser(u);
    setSelected(remembered(u.id));
  }
  async function logout() {
    generation.current++;
    try {
      await api("auth/logout", { method: "POST", body: "{}" });
    } catch {}
    disconnect();
    setUser(null);
    setEvents([]);
    setEvent(null);
    setVendors([]);
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
        catalog,
        setUser,
        error,
        loading,
        refresh,
        selectEvent: (id) => {
          if (user)
            try {
              localStorage.setItem(eventKey(user.id), id);
            } catch {}
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
