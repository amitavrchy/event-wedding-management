"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { useApp } from "./context";
export function useResource<T>(path: string | null, initial: T) {
  const { notify } = useApp();
  const [data, setData] = useState<T>(initial),
    [loading, setLoading] = useState(false);
  const version = useRef(0);
  const reload = useCallback(async () => {
    const request = ++version.current;
    if (!path) {
      setData(initial);
      return;
    }
    setLoading(true);
    try {
      const result = await api<T>(path);
      if (request === version.current) setData(result);
    } catch (e) {
      if (request === version.current) notify((e as Error).message, true);
    } finally {
      if (request === version.current) setLoading(false);
    }
  }, [path, notify]);
  useEffect(() => {
    void reload();
    return () => {
      version.current++;
    };
  }, [reload]);
  return { data, setData, reload, loading };
}
export function useAction() {
  const { notify } = useApp();
  const [busy, setBusy] = useState(false);
  async function run(action: () => Promise<unknown>, message?: string) {
    setBusy(true);
    try {
      await action();
      if (message) notify(message);
      return true;
    } catch (e) {
      notify((e as Error).message, true);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, run };
}
