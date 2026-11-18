import { Suspense } from "react";
import PollarApp from "@/components/PollarApp";

export default function RegistroLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <PollarApp>{children}</PollarApp>
    </Suspense>
  );
}
