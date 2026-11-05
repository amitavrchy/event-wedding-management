"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download } from "lucide-react";
import { Button } from "./ui";
export function GuestPass({ token, name }: { token: string; name: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    void QRCode.toDataURL(`${location.origin}/rsvp/${token}`, {
      width: 320,
      margin: 2,
      color: { dark: "#803048", light: "#fffdf8" },
    }).then(setUrl);
  }, [token]);
  return (
    <div className="guest-pass">
      {url && (
        <img
          src={url}
          width={180}
          height={180}
          alt={`Check-in invitation QR code for ${name}`}
        />
      )}
      <div>
        <h3>Your celebration pass</h3>
        <p>Show this code to the welcome team when you arrive.</p>
        {url && (
          <a
            className="button secondary"
            download="utsab-invitation.png"
            href={url}
          >
            <Download size={16} />
            Save your pass
          </a>
        )}
      </div>
    </div>
  );
}
