"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STORES } from "@/lib/domain/catalog";

const items = STORES.map((s) => ({ value: s.id, label: s.name }));

export function StoreSwitcher({ storeId, basePath = "/stores" }: { storeId: string; basePath?: string }) {
  const router = useRouter();
  return (
    <Select
      items={items}
      value={storeId}
      onValueChange={(value) => {
        if (value && value !== storeId) router.push(`${basePath}/${value}`);
      }}
    >
      <SelectTrigger className="min-w-56 font-medium" aria-label="Select store">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
