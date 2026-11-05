"use client";
import { useEffect, useState } from "react";
import { Bell, Check } from "lucide-react";
import { api } from "@/lib/api";
import { useApp } from "@/lib/context";
import { dateLabel } from "@/lib/format";
import { Button, Empty, PageHeading } from "@/components/ui";
type Notice = {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
};
export default function Notifications() {
  const { notify } = useApp();
  const [notices, setNotices] = useState<Notice[]>([]);
  useEffect(() => {
    void api<Notice[]>("notifications")
      .then(setNotices)
      .catch((e) => notify(e.message, true));
  }, [notify]);
  return (
    <>
      <PageHeading
        eyebrow="A LITTLE NUDGE, RIGHT ON TIME"
        title="Room for the important things"
        description="Payment reminders, RSVP deadlines, and the next little detail on your list."
      />
      <div className="notice-list">
        {notices.map((n) => (
          <article
            key={n.id}
            className={`card notice-card ${n.read ? "is-read" : ""}`}
          >
            <span className="stat-icon rose">
              <Bell size={20} />
            </span>
            <div>
              <h2>{n.title}</h2>
              <p>{n.body}</p>
              <small>{dateLabel(n.createdAt)}</small>
            </div>
            {!n.read && (
              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    await api(`notifications/${n.id}/read`, {
                      method: "PATCH",
                    });
                    setNotices((current) =>
                      current.map((i) =>
                        i.id === n.id ? { ...i, read: true } : i,
                      ),
                    );
                  } catch (e) {
                    notify((e as Error).message, true);
                  }
                }}
              >
                <Check size={17} />
                Mark read
              </Button>
            )}
          </article>
        ))}
      </div>
      {!notices.length && (
        <Empty title="A lovely, quiet moment">
          Your planning reminders will appear here as dates draw closer.
        </Empty>
      )}
    </>
  );
}
