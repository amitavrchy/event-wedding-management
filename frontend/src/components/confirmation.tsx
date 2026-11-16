"use client";
import { useEffect, useRef, useState } from "react";
import { Button, Modal } from "./ui";

type Request = { message: string; resolve: (confirmed: boolean) => void };
let listener: ((request: Request) => void) | null = null;

/** Ask before a destructive action. Without a mounted host, fail closed. */
export function confirmAction(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (listener) listener({ message, resolve });
    else resolve(false);
  });
}

export function ConfirmationHost() {
  const [request, setRequest] = useState<Request | null>(null);
  const pending = useRef<Request | null>(null);
  useEffect(() => {
    listener = (next) => {
      pending.current?.resolve(false);
      pending.current = next;
      setRequest(next);
    };
    return () => {
      listener = null;
      pending.current?.resolve(false);
      pending.current = null;
    };
  }, []);
  if (!request) return null;
  const finish = (result: boolean) => {
    pending.current = null;
    request.resolve(result);
    setRequest(null);
  };
  return (
    <Modal title="Please confirm" onClose={() => finish(false)}>
      <p>{request.message}</p>
      <div className="button-group">
        <Button variant="secondary" onClick={() => finish(false)}>
          Cancel
        </Button>
        <Button onClick={() => finish(true)}>Confirm</Button>
      </div>
    </Modal>
  );
}
