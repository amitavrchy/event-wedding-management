"use client";
import { useState } from "react";
import { Search, Heart, Cake, BriefcaseBusiness, Flower2, Gem, PartyPopper, Utensils, Baby, Moon, Flame, Music, GraduationCap, Users, Mic, Wrench, Rocket, Trees, Trophy, House, BookOpen, Palette, Gift, Leaf, Soup, HandHeart } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const occasionIcons: Record<string, LucideIcon> = {
  favorite: Heart, cake: Cake, work: BriefcaseBusiness, flower: Flower2,
  diamond: Gem, celebration: PartyPopper, restaurant: Utensils, child: Baby,
  moon: Moon, flame: Flame, music: Music, school: GraduationCap, groups: Users,
  mic: Mic, build: Wrench, rocket: Rocket, park: Trees, trophy: Trophy,
  home: House, book: BookOpen, palette: Palette, bouquet: Gift, leaf: Leaf, bowl: Soup, charity: HandHeart,
};
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
    {searching && <div className="occasion-search"><Search size={20} aria-hidden="true" /><input autoFocus aria-label={bn ? "অনুষ্ঠান খুঁজুন" : "Search occasions"} placeholder={bn ? "অনুষ্ঠান খুঁজুন" : "Search occasions"} value={query} onChange={(e) => setQuery(e.target.value)} /></div>}
    {list.length === 0 ? <p role="status">{bn ? "কোনো অনুষ্ঠান পাওয়া যায়নি।" : "No occasions found."}</p> :
      <div className="occasion-grid" role="list">{list.map((t) => { const OccasionIcon = occasionIcons[t.iconKey] || PartyPopper; return <button key={t.type} role="listitem" className="occasion-card" onClick={() => setChosen(t.type)} aria-label={bn ? `${t.labelBn} বেছে নিন` : `Choose ${t.label}`}>
        <span className="occasion-icon" aria-hidden="true"><OccasionIcon size={44} strokeWidth={1.7} /></span>
        <span className="occasion-body"><strong>{bn ? t.labelBn : t.label}</strong><span className="occasion-description">{bn ? t.descriptionBn : t.description}</span></span>
      </button>; })}</div>}
  </Modal>;
}
