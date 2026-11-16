"use client";
import { useState } from "react";
import { Search } from "lucide-react";
import "@/app/occasion.css";
import { eventTypes } from "@/lib/event-types";
import { usePublicLocale } from "@/lib/public-i18n";
import { Modal } from "./ui";
import { NewEvent } from "./new-event";

export function OccasionPicker({ onClose, dismissible = true }: { onClose: () => void; dismissible?: boolean }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const { locale, toggle } = usePublicLocale();
  const bn = locale === "bn";
  if (chosen) return <NewEvent initialType={chosen} onClose={onClose} onBack={() => setChosen(null)} />;
  const term = query.trim().toLocaleLowerCase();
  const list = eventTypes.filter((t) => [t.label, t.labelBn, t.description, t.descriptionBn].some((value) => value.toLocaleLowerCase().includes(term)));
  return <Modal title={bn ? "কোন অনুষ্ঠানের পরিকল্পনা করছেন?" : "What are you planning?"} onClose={dismissible ? onClose : () => undefined}>
    <div className="occasion-actions">
      <p className="muted">{bn ? "আপনার অনুষ্ঠান বেছে নিন।" : "Choose your occasion to get started."}</p>
      <button type="button" className="occasion-search-button" aria-label={bn ? "অনুষ্ঠান খুঁজুন" : "Search occasions"} onClick={() => { if (searching) setQuery(""); setSearching(!searching); }}><Search size={22} /></button>
      <button type="button" className="link-button" onClick={toggle}>{bn ? "English" : "বাংলা"}</button>
    </div>
    {searching && <input autoFocus className="occasion-search" aria-label={bn ? "অনুষ্ঠান খুঁজুন" : "Search occasions"} placeholder={bn ? "অনুষ্ঠান খুঁজুন" : "Search occasions"} value={query} onChange={(e) => setQuery(e.target.value)} />}
    {list.length === 0 ? <p role="status">{bn ? "কোনো অনুষ্ঠান পাওয়া যায়নি।" : "No occasions found."}</p> :
      <div className="occasion-grid" role="list">{list.map((t) => <button key={t.type} role="listitem" className="occasion-card" onClick={() => setChosen(t.type)} aria-label={`Plan a ${t.label}`}>
        <span className="occasion-icon" aria-hidden="true">{t.icon}</span>
        <span className="occasion-body"><strong>{bn ? t.labelBn : t.label}</strong><span className="occasion-bn">{bn ? t.label : t.labelBn}</span><span className="occasion-description">{bn ? t.descriptionBn : t.description}</span></span>
      </button>)}</div>}
  </Modal>;
}
