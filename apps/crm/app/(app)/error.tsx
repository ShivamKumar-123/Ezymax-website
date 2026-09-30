"use client";

import * as React from "react";
import Link from "next/link";
import { RotateCw } from "lucide-react";
import { Button, Card, EmptyState } from "@kalks/ui";
import { useT } from "@kalks/i18n/react";

/** A page of the Client Area failed to render: say so plainly, keep the shell, offer a retry and the dashboard. */
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useT();
  React.useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="pb-16 pt-6">
      <Card>
        <EmptyState
          art="connectionLost"
          title={t("shell.system.error.title")}
          text={t("shell.system.error.text")}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="surface" onClick={retry}>
                <RotateCw /> {t("common.retry")}
              </Button>
              <Link href="/">
                <Button variant="ghost">{t("shell.system.unavailable.back")}</Button>
              </Link>
            </div>
          }
        />
      </Card>
    </div>
  );
}
