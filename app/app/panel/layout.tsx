import { Suspense } from "react";
import PollarApp from "@/components/auth/PollarApp";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <PollarApp>{children}</PollarApp>
    </Suspense>
  );
}
