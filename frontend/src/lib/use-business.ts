"use client";
import { useState } from "react";
import { Vendor } from "./types";
import { useResource } from "./use-resource";
export function useBusiness() {
  const { data: businesses, reload: reloadBusinesses } = useResource<Vendor[]>(
    "vendors/mine",
    [],
  );
  const [chosen, setChosen] = useState("");
  const business =
    businesses.find((b) => b.id === chosen) || businesses[0] || null;
  return { businesses, business, choose: setChosen, reloadBusinesses };
}
