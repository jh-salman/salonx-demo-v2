import { createContext, use } from "react";

export const RampContext = createContext(null);

export function useRamp() {
  const ctx = use(RampContext);
  if (!ctx) throw new Error("useRamp must be used within RampApp");
  return ctx;
}
