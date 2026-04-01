import { createContext, useContext, ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

interface EmbedContextValue {
  isEmbed: boolean;
}

const EmbedContext = createContext<EmbedContextValue>({ isEmbed: false });

export function EmbedProvider({ children }: { children: ReactNode }) {
  const [searchParams] = useSearchParams();
  const isEmbed = searchParams.get("embed") === "true";
  return (
    <EmbedContext.Provider value={{ isEmbed }}>
      {children}
    </EmbedContext.Provider>
  );
}

export function useEmbed() {
  return useContext(EmbedContext);
}
