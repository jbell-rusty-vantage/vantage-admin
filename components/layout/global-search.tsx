"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import type { DatabaseScope } from "@/lib/api/types";

export function GlobalSearch({ scope = "production" }: { scope?: DatabaseScope }) {
  const [query, setQuery] = useState("");

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    const params = new URLSearchParams({
      q: trimmed,
      database_scope: scope,
    });
    window.location.assign(`/search?${params.toString()}`);
  }

  return (
    <form onSubmit={onSubmit} className="relative w-full max-w-md">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search job, phone, email, ObjectId..."
        className="pl-9"
        aria-label="Global search"
      />
    </form>
  );
}
