"use client";
import { useEffect, useRef, useState } from "react";
import { MessageCircle, Plus, Send } from "lucide-react";
import { api, json } from "@/lib/api";
import { useApp } from "@/lib/context";
import { Conversation, Message } from "@/lib/types";
import { socket } from "@/lib/socket";
import { Button, Empty, Field, Modal, PageHeading } from "@/components/ui";
export default function Messages() {
  const { user, event, vendors, notify } = useApp();
  const [conversations, setConversations] = useState<Conversation[]>([]),
    [selected, setSelected] = useState<Conversation | null>(null),
    [messages, setMessages] = useState<Message[]>([]),
    [adding, setAdding] = useState(false),
    [busy, setBusy] = useState(false),
    [body, setBody] = useState("");
  const latest = useRef<HTMLDivElement>(null);
  async function load() {
    try {
      const result = await api<Conversation[]>("conversations");
      const visible = result.filter(
        (c) => user?.role === "VENDOR" || c.eventId === event?.id,
      );
      setConversations(visible);
      // Deep link from notifications and the inquiry inbox: /messages?c=<id>
      const wanted = new URLSearchParams(location.search).get("c");
      const match = wanted && visible.find((c) => c.id === wanted);
      if (match) setSelected(match);
    } catch (e) {
      notify((e as Error).message, true);
    }
  }
  useEffect(() => {
    setSelected(null);
    setMessages([]);
    void load();
  }, [event?.id]);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    const read = () =>
      api<Message[]>(`conversations/${selected.id}/messages`)
        .then((m) => {
          if (active) setMessages(m);
        })
        .catch(() => {});
    void read();
    const connection = socket();
    const join = () => connection.emit("join", selected.id);
    const receive = (message: Message) =>
      setMessages((current) =>
        current.some((m) => m.id === message.id)
          ? current
          : [...current, message],
      );
    connection.on("connect", join);
    connection.on("message", receive);
    if (connection.connected) join();
    const timer = setInterval(() => void read(), 5000);
    return () => {
      active = false;
      clearInterval(timer);
      connection.emit("leave", selected.id);
      connection.off("connect", join);
      connection.off("message", receive);
    };
  }, [selected]);
  useEffect(() => {
    latest.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length]);
  return (
    <>
      <PageHeading
        eyebrow="GREAT CELEBRATIONS START WITH A CONVERSATION"
        title="A little hello goes a long way"
        description="Ideas, questions, and all the lovely details. Keep the conversation together."
        action={
          user?.role !== "VENDOR" ? (
            <Button disabled={!event} onClick={() => setAdding(true)}>
              <Plus size={18} />
              New conversation
            </Button>
          ) : undefined
        }
      />
      <section className="card messaging">
        <aside className="conversation-list">
          <h2>Your conversations</h2>
          {conversations.map((c) => (
            <button
              className={`conversation ${selected?.id === c.id ? "selected" : ""}`}
              key={c.id}
              onClick={() => setSelected(c)}
            >
              <span className="person-avatar">
                <MessageCircle size={20} />
              </span>
              <span>
                <strong>
                  {(user?.role === "VENDOR" ? c.eventTitle : c.vendorName) ||
                    vendors.find((v) => v.id === c.vendorId)?.businessName ||
                    "Event conversation"}
                </strong>
                <small>Let’s make something beautiful</small>
              </span>
            </button>
          ))}
          {!conversations.length && <Empty title="Say your first hello" />}
        </aside>
        <div className="message-panel">
          {selected ? (
            <>
              <div className="chat-header">
                <span className="person-avatar">
                  <MessageCircle size={20} />
                </span>
                <div>
                  <h3>
                    {(user?.role === "VENDOR"
                      ? selected.eventTitle
                      : selected.vendorName) ||
                      vendors.find((v) => v.id === selected.vendorId)
                        ?.businessName ||
                      "Your celebration conversation"}
                  </h3>
                  <p>All the little details, together</p>
                </div>
              </div>
              <div className="messages-body">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`message ${m.senderId === user?.id ? "mine" : ""}`}
                  >
                    <p>{m.body}</p>
                    <time>
                      {new Date(m.createdAt).toLocaleTimeString("en-GB", {
                        timeZone: "Asia/Dhaka",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                ))}
                {!messages.length && (
                  <Empty title="The start of something lovely">
                    Share your ideas or ask a question.
                  </Empty>
                )}
                <div ref={latest} />
              </div>
              <form
                className="message-composer"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!body.trim()) return;
                  setBusy(true);
                  try {
                    const m = await api<Message>(
                      `conversations/${selected.id}/messages`,
                      { method: "POST", body: json({ body }) },
                    );
                    setMessages((current) =>
                      current.some((i) => i.id === m.id)
                        ? current
                        : [...current, m],
                    );
                    setBody("");
                  } catch (e) {
                    notify((e as Error).message, true);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <input
                  aria-label="Your message"
                  placeholder="A question, an idea, a little hello…"
                  value={body}
                  maxLength={4000}
                  required
                  onChange={(e) => setBody(e.target.value)}
                />
                <Button busy={busy} aria-label="Send message">
                  <Send size={18} />
                </Button>
              </form>
            </>
          ) : (
            <Empty title="Your ideas belong here">
              Choose a conversation or say hello to an event professional.
            </Empty>
          )}
        </div>
      </section>
      {adding && (
        <Modal
          title="Start with a little hello"
          onClose={() => setAdding(false)}
        >
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const f = new FormData(e.currentTarget);
              try {
                const c = await api<Conversation>("conversations", {
                  method: "POST",
                  body: json({
                    eventId: event?.id,
                    vendorId: f.get("vendorId"),
                  }),
                });
                await load();
                setSelected(c);
                setAdding(false);
              } catch (e) {
                notify((e as Error).message, true);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Who would you like to talk to?">
              <select name="vendorId" required>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.businessName}
                  </option>
                ))}
              </select>
            </Field>
            <Button busy={busy}>Start conversation</Button>
          </form>
        </Modal>
      )}
    </>
  );
}
