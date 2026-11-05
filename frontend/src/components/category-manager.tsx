"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api, json } from "@/lib/api";
import { useResource, useAction } from "@/lib/use-resource";
import { Button, Field } from "./ui";
export function CategoryManager() {
  const { data, reload } = useResource<{ id: string; name: string }[]>(
    "categories",
    [],
  );
  const { busy, run } = useAction();
  const [name, setName] = useState("");
  return (
    <section className="card category-manager">
      <div className="card-heading">
        <div>
          <h2>Marketplace categories</h2>
          <p>
            Manage the specialties available to new professionals. Hidden
            categories can be restored by adding the same name.
          </p>
        </div>
      </div>
      <form
        className="category-create padded"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await run(async () => {
              await api("categories", { method: "POST", body: json({ name }) });
              await reload();
            }, "Marketplace category saved")
          )
            setName("");
        }}
      >
        <Field label="New category name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            maxLength={50}
            placeholder="Live music"
          />
        </Field>
        <Button busy={busy}>
          <Plus size={17} />
          Add category
        </Button>
      </form>
      <div className="category-pills">
        {data.map((c) => (
          <span key={c.id}>
            {c.name}
            <button
              className="icon-button"
              aria-label={`Hide category ${c.name}`}
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await api(`categories/${c.id}`, {
                    method: "PATCH",
                    body: json({ enabled: false }),
                  });
                  await reload();
                }, "Category hidden from new applications")
              }
            >
              <Trash2 size={14} />
            </button>
          </span>
        ))}
      </div>
    </section>
  );
}
