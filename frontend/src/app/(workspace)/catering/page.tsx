"use client";
import { useState } from "react";
import { Printer, UtensilsCrossed } from "lucide-react";
import "@/app/tools.css";
import { useApp } from "@/lib/context";
import { useResource } from "@/lib/use-resource";
import { dateLabel } from "@/lib/format";
import { downloadCSV } from "@/lib/csv";
import {
  Button,
  CardHeading,
  Empty,
  Field,
  PageHeading,
} from "@/components/ui";

type Plan = {
  confirmedPeople: number;
  pendingPeople: number;
  meals: Record<string, number>;
  recommendedPlates: number;
  dietaryNotes: { name: string; note: string }[];
};
type Catering = {
  bufferPercent: number;
  guestCapacity: number;
  overall: Plan;
  days: (Plan & {
    dayId: string;
    name: string;
    startsAt: string;
    venueName?: string;
  })[];
};

function PlanCard({
  title,
  subtitle,
  plan,
}: {
  title: string;
  subtitle?: string;
  plan: Plan;
}) {
  return (
    <section className="card padded catering-card">
      <CardHeading title={title} subtitle={subtitle} />
      <div className="catering-number">
        <strong>{plan.recommendedPlates}</strong>
        <span>plates to order</span>
      </div>
      <p className="muted">
        {plan.confirmedPeople} confirmed · up to {plan.pendingPeople} more
        awaiting reply
      </p>
      <ul className="meal-list">
        {Object.entries(plan.meals).map(([meal, count]) => (
          <li key={meal}>
            <span>{meal}</span>
            <strong>{count}</strong>
          </li>
        ))}
      </ul>
      {plan.dietaryNotes.length > 0 && (
        <details>
          <summary>{plan.dietaryNotes.length} dietary notes</summary>
          <ul>
            {plan.dietaryNotes.map((d) => (
              <li key={d.name}>
                <strong>{d.name}:</strong> {d.note}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

export default function CateringPage() {
  const { event } = useApp();
  const [buffer, setBuffer] = useState(10);
  const data = useResource<Catering | null>(
    event ? `events/${event.id}/catering?buffer=${buffer}` : null,
    null,
  );
  if (!event) return <Empty title="Create a celebration first" />;
  return (
    <>
      <PageHeading
        eyebrow="খাবারের হিসাব"
        title="Catering headcount"
        description="Plates per day and meal, straight from RSVPs. Share or print it for your caterer."
        action={
          <div className="button-group no-print">
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer size={17} /> Kitchen sheet
            </Button>
            {data.data && (
              <Button
                variant="secondary"
                onClick={() =>
                  downloadCSV(
                    "catering.csv",
                    [
                      "day",
                      "confirmed",
                      "plates",
                      ...Object.keys(data.data!.overall.meals),
                    ],
                    data.data!.days.map((d) => [
                      d.name,
                      String(d.confirmedPeople),
                      String(d.recommendedPlates),
                      ...Object.keys(data.data!.overall.meals).map((m) =>
                        String(d.meals[m] || 0),
                      ),
                    ]),
                  )
                }
              >
                Export
              </Button>
            )}
          </div>
        }
      />
      <div className="filter-bar no-print">
        <Field label={`Safety buffer: ${buffer}%`}>
          <input
            type="range"
            min="0"
            max="30"
            step="5"
            value={buffer}
            onChange={(e) => setBuffer(Number(e.target.value))}
          />
        </Field>
      </div>
      {data.data && (
        <div className="catering-grid">
          <PlanCard title="Whole event" plan={data.data.overall} />
          {data.data.days.map((d) => (
            <PlanCard
              key={d.dayId}
              title={d.name}
              subtitle={`${dateLabel(d.startsAt)}${d.venueName ? ` · ${d.venueName}` : ""}`}
              plan={d}
            />
          ))}
        </div>
      )}
      {data.data && !data.data.days.length && (
        <div className="info-note">
          <UtensilsCrossed size={18} /> Add event days to see plates per day.
        </div>
      )}
    </>
  );
}
