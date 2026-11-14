"use client";
import { useEffect, useState } from "react";
import { Vendor } from "./types";
import { useResource } from "./use-resource";

const KEY = "ayojon-business";
/** The vendor's businesses and the one being managed (remembered per browser). */
export function useBusiness() {
  const {
    data: businesses,
    reload: reloadBusinesses,
    loading,
  } = useResource<Vendor[]>("vendors/mine", []);
  const [chosen, setChosen] = useState("");
  useEffect(() => {
    try {
      setChosen(localStorage.getItem(KEY) || "");
    } catch {}
  }, []);
  const choose = (id: string) => {
    setChosen(id);
    try {
      localStorage.setItem(KEY, id);
    } catch {}
  };
  const business =
    businesses.find((b) => b.id === chosen) || businesses[0] || null;
  return { businesses, business, choose, reloadBusinesses, loading };
}
