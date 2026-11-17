"use client";
import { useState } from "react";
import { Check } from "lucide-react";
import "@/app/occasion.css";
import { useApp } from "@/lib/context";
import { eventTypes } from "@/lib/event-types";
import { Modal } from "./ui";
import { NewEvent } from "./new-event";

const featured = [
  "WEDDING",
  "HOLUD",
  "RECEPTION",
  "ENGAGEMENT",
  "BIRTHDAY",
  "ANNIVERSARY",
  "CORPORATE",
  "CONFERENCE",
];

/**
 * First step of every new event: "What are you planning?". The chosen
 * occasion decides which tools the workspace shows.
 */
export function OccasionPicker({
  onClose,
  dismissible = true,
}: {
  onClose: () => void;
  dismissible?: boolean;
}) {
  const { catalog } = useApp();
  const [chosen, setChosen] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  if (chosen)
    return (
      <NewEvent
        initialType={chosen}
        onClose={onClose}
        onBack={() => setChosen(null)}
      />
    );
  const list = showAll
    ? eventTypes
    : eventTypes.filter((t) => featured.includes(t.type));
  const toolsFor = (type: string) =>
    (catalog?.occasionDefaults[type] || [])
      .map((key) => catalog?.features.find((f) => f.key === key)?.label)
      .filter(Boolean)
      .slice(0, 4) as string[];
  return (
    <Modal
      title="What are you planning?"
      onClose={dismissible ? onClose : () => undefined}
    >
      <p className="muted">
        কোন অনুষ্ঠানের পরিকল্পনা করছেন? Choose your occasion and we’ll show only
        the tools it needs. You can add more any time from settings.
      </p>
      <div className="occasion-grid" role="list">
        {list.map((t) => {
          const tools = toolsFor(t.type);
          return (
            <button
              key={t.type}
              role="listitem"
              className="occasion-card"
              onClick={() => setChosen(t.type)}
              aria-label={`Plan a ${t.label}`}
            >
              <span
                className="occasion-image"
                style={{ backgroundImage: `url(${t.image})` }}
              />
              <span className="occasion-body">
                <strong>{t.label}</strong>
                <span className="occasion-bn" lang="bn">
                  {t.labelBn}
                </span>
                {tools.length > 0 && (
                  <span className="occasion-tools">
                    {tools.map((tool) => (
                      <span key={tool}>
                        <Check size={12} /> {tool}
                      </span>
                    ))}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      {!showAll && (
        <button className="occasion-more" onClick={() => setShowAll(true)}>
          More occasions: baby shower, graduation, reunion, community, other
        </button>
      )}
    </Modal>
  );
}
