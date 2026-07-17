"use client";

import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";

export type TourStep = {
  elementId?: string;
  intro: string;
  position?: "top" | "bottom" | "left" | "right";
};

type HeaderConfig = {
  title: string;
  breadcrumb?: string;
  actions?: ReactNode;
  tourSteps?: TourStep[];
};

type Ctx = {
  header: HeaderConfig;
  setHeader: (h: HeaderConfig) => void;
};

const PageHeaderContext = createContext<Ctx | null>(null);

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [header, setHeader] = useState<HeaderConfig>({ title: "" });
  const value = useMemo(() => ({ header, setHeader }), [header]);
  return <PageHeaderContext.Provider value={value}>{children}</PageHeaderContext.Provider>;
}

/** Call once per page, mirrors Django's {% block page_title/breadcrumb/top_actions %}. */
export function usePageHeader(config: HeaderConfig) {
  const ctx = useContext(PageHeaderContext);
  if (!ctx) throw new Error("usePageHeader must be used within PageHeaderProvider");
  const { setHeader } = ctx;

  useEffect(() => {
    setHeader(config);
    return () => setHeader({ title: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.title, config.breadcrumb, config.tourSteps, config.actions]);
}

export function usePageHeaderValue() {
  const ctx = useContext(PageHeaderContext);
  if (!ctx) throw new Error("usePageHeaderValue must be used within PageHeaderProvider");
  return ctx.header;
}