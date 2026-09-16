/**
 * Overview: is Gentle AI installed on this machine, and is it healthy.
 *
 * Doctor and the update check are commands rather than queries, so scrolling
 * past this section never spawns a CLI process.
 *
 * @module components/gentle-ai/OverviewSection
 */
import type {
  GentleAiDoctorReport,
  GentleAiStatus,
  GentleAiUpdateReport,
} from "@t3tools/contracts";
import {
  ArrowUpCircleIcon,
  BrainIcon,
  DownloadIcon,
  PackageIcon,
  StethoscopeIcon,
} from "lucide-react";
import { useCallback, useState } from "react";

import { usePrimaryEnvironmentId } from "~/state/environments";
import {
  gentleAiDoctorCommand,
  gentleAiUpdateCheckCommand,
  useGentleAiRunner,
} from "~/state/gentleAi";
import { useAtomCommand } from "~/state/use-atom-command";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { formatRelativeTime } from "./gentleAi.logic";
import {
  GentleCard,
  GentleCardTitle,
  GentleField,
  GentleSection,
  GentleStatusIcon,
} from "./primitives";

const BINARY_SOURCE_LABEL = {
  path: "PATH",
  "go-bin": "~/go/bin",
  "not-found": "not found",
} as const;

function BinaryCard({ status }: { readonly status: GentleAiStatus }) {
  const { binary, platform, goAvailable } = status;
  const { run, isRunning, isAvailable } = useGentleAiRunner();
  const installBinary = useCallback(() => {
    void run({ kind: "install-binary" });
  }, [run]);

  return (
    <GentleCard>
      <GentleCardTitle
        icon={<PackageIcon className="size-4 text-muted-foreground" />}
        action={
          binary.installed ? (
            <Badge size="control" variant="success">
              v{binary.version ?? "unknown"}
            </Badge>
          ) : (
            <Badge size="control" variant="warning">
              Missing
            </Badge>
          )
        }
      >
        gentle-ai binary
      </GentleCardTitle>
      {binary.installed ? (
        <div className="space-y-0.5">
          <GentleField label="Path" value={binary.path ?? "unknown"} mono />
          <GentleField label="Found via" value={BINARY_SOURCE_LABEL[binary.source]} />
          <GentleField label="Version" value={binary.version ?? "unknown"} />
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">
            The hub can install it for you.{" "}
            {platform === "win32"
              ? "Windows installs through `go install`, so a Go toolchain is required."
              : "The published install script is piped into bash."}
          </p>
          <pre className="overflow-x-auto rounded-lg border border-border/60 bg-muted/24 px-2.5 py-2 font-mono text-[0.6875rem] text-foreground/85">
            {binary.installHint}
          </pre>
          {platform === "win32" ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <GentleStatusIcon status={goAvailable ? "ok" : "fail"} />
              {goAvailable
                ? "Go is on PATH."
                : "Go is not on PATH. Install Go first, then run this again."}
            </p>
          ) : null}
          <Button
            size="sm"
            onClick={installBinary}
            disabled={isRunning || !isAvailable || (platform === "win32" && !goAvailable)}
          >
            {isRunning ? <Spinner /> : <DownloadIcon />}
            Install binary
          </Button>
        </div>
      )}
    </GentleCard>
  );
}

function EngramCard({ status }: { readonly status: GentleAiStatus }) {
  const { engram } = status;
  return (
    <GentleCard>
      <GentleCardTitle
        icon={<BrainIcon className="size-4 text-muted-foreground" />}
        action={
          engram.installed ? (
            <Badge size="control" variant="success">
              v{engram.version ?? "unknown"}
            </Badge>
          ) : (
            <Badge size="control" variant="secondary">
              Not installed
            </Badge>
          )
        }
      >
        Engram memory
      </GentleCardTitle>
      {engram.installed ? (
        <div className="space-y-0.5">
          <GentleField label="Path" value={engram.path ?? "unknown"} mono />
          <GentleField label="Version" value={engram.version ?? "unknown"} />
        </div>
      ) : (
        <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">
          Engram is the persistent-memory MCP server. Install it by including the
          <span className="font-medium text-foreground"> Engram </span>
          component in a setup run.
        </p>
      )}
    </GentleCard>
  );
}

function DoctorCard({ available }: { readonly available: boolean }) {
  const environmentId = usePrimaryEnvironmentId();
  const runDoctor = useAtomCommand(gentleAiDoctorCommand, { reportFailure: false });
  const [report, setReport] = useState<GentleAiDoctorReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const check = useCallback(async () => {
    if (environmentId === null) return;
    setPending(true);
    setError(null);
    const result = await runDoctor({ environmentId, input: {} });
    setPending(false);
    if (result._tag === "Success") {
      setReport(result.value);
      return;
    }
    setReport(null);
    setError("Doctor could not run on this machine.");
  }, [environmentId, runDoctor]);

  return (
    <GentleCard>
      <GentleCardTitle
        icon={<StethoscopeIcon className="size-4 text-muted-foreground" />}
        action={
          <Button
            size="xs"
            variant="outline"
            onClick={() => void check()}
            disabled={pending || !available}
          >
            {pending ? <Spinner /> : null}
            Run doctor
          </Button>
        }
      >
        Health check
      </GentleCardTitle>
      {error !== null ? (
        <p className="text-[0.8125rem] text-destructive-foreground">{error}</p>
      ) : report === null ? (
        <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">
          {available
            ? "Runs every Gentle AI self-check and lists what passed, warned, or failed."
            : "Install the gentle-ai binary to run its self-checks."}
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge size="control" variant={report.healthy ? "success" : "warning"}>
              {report.healthy ? "Healthy" : "Needs attention"}
            </Badge>
            <span className="text-muted-foreground">
              {report.summary.passed} passed · {report.summary.warnings} warnings ·{" "}
              {report.summary.failed} failed
            </span>
          </div>
          <ul className="divide-y divide-border/50 rounded-lg border border-border/50">
            {report.checks.map((check) => (
              <li key={check.id} className="flex items-start gap-2 px-2.5 py-2 text-[0.8125rem]">
                <GentleStatusIcon status={check.status} className="mt-0.5" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-foreground">{check.id}</span>
                  {check.detail.length > 0 ? (
                    <span className="block text-xs leading-relaxed text-muted-foreground">
                      {check.detail}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </GentleCard>
  );
}

function UpdatesCard({ available }: { readonly available: boolean }) {
  const environmentId = usePrimaryEnvironmentId();
  const checkUpdates = useAtomCommand(gentleAiUpdateCheckCommand, { reportFailure: false });
  const { run, isRunning } = useGentleAiRunner();
  const [report, setReport] = useState<GentleAiUpdateReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const check = useCallback(async () => {
    if (environmentId === null) return;
    setPending(true);
    setError(null);
    const result = await checkUpdates({ environmentId, input: {} });
    setPending(false);
    if (result._tag === "Success") {
      setReport(result.value);
      return;
    }
    setReport(null);
    setError("The update check could not run on this machine.");
  }, [checkUpdates, environmentId]);

  return (
    <GentleCard>
      <GentleCardTitle
        icon={<ArrowUpCircleIcon className="size-4 text-muted-foreground" />}
        action={
          <>
            {report !== null && !report.upToDate ? (
              <Button
                size="xs"
                onClick={() => void run({ kind: "upgrade" })}
                disabled={isRunning || !available}
              >
                Upgrade
              </Button>
            ) : null}
            <Button
              size="xs"
              variant="outline"
              onClick={() => void check()}
              disabled={pending || !available}
            >
              {pending ? <Spinner /> : null}
              Check updates
            </Button>
          </>
        }
      >
        Updates
      </GentleCardTitle>
      {error !== null ? (
        <p className="text-[0.8125rem] text-destructive-foreground">{error}</p>
      ) : report === null ? (
        <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">
          {available
            ? "Compares the installed Gentle AI tools against the latest published versions."
            : "Install the gentle-ai binary to compare it against the latest release."}
        </p>
      ) : report.entries.length === 0 ? (
        <p className="text-[0.8125rem] text-muted-foreground">
          The CLI reported no tools to compare.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tool</TableHead>
              <TableHead>Installed</TableHead>
              <TableHead>Latest</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.entries.map((entry) => (
              <TableRow key={entry.tool}>
                <TableCell className="font-medium">{entry.tool}</TableCell>
                <TableCell className="font-mono text-[0.6875rem]">
                  {entry.installed ?? "—"}
                </TableCell>
                <TableCell className="font-mono text-[0.6875rem]">{entry.latest ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <Badge
                    size="sm"
                    variant={
                      entry.status === "ok"
                        ? "success"
                        : entry.status === "outdated"
                          ? "warning"
                          : "secondary"
                    }
                  >
                    {entry.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </GentleCard>
  );
}

export function OverviewSection({ status }: { readonly status: GentleAiStatus }) {
  const available = status.binary.installed;
  return (
    <GentleSection
      id="overview"
      title="Overview"
      description="What this machine has installed, and whether Gentle AI considers it healthy."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <BinaryCard status={status} />
        <EngramCard status={status} />
        <DoctorCard available={available} />
        <UpdatesCard available={available} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[0.6875rem] text-muted-foreground/80">
        <span className="font-mono">{status.stateFilePath}</span>
        <span>
          Checked {formatRelativeTime(status.checkedAt) ?? status.checkedAt} · {status.platform}
        </span>
      </div>
    </GentleSection>
  );
}
