"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Re-reads the server component every few seconds while the instance is not active yet.
export default function Osvjezavanje({ svakihMs = 3000 }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), svakihMs);
    return () => clearInterval(id);
  }, [router, svakihMs]);
  return null;
}
