"use client";

import * as React from "react";
import { Download, Pencil, Plus, Server, Trash2, Upload, X } from "lucide-react";

import {
  createAssetAction,
  deleteAssetAction,
  importAssetsAction,
  updateAssetAction,
} from "@/app/asset-actions";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  PieChart,
  PieLegend,
  type PieSegment,
} from "@/components/ui/pie-chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { matchCveToAssets } from "@/lib/asset-match";
import { formatCpeType, type CveRecord } from "@/lib/cve";
import {
  ASSET_CPE_TYPES,
  ASSET_ENVIRONMENTS,
  type Asset,
  type AssetDraft,
  emptyAssetDraft,
  exportAssetsBlob,
  validateDraft,
} from "@/lib/assets";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(new Date(value));
}

const FIELD_LABEL = "mb-1 block text-xs font-medium text-muted-foreground";

type FormState = AssetDraft & { editingId: string | null };

function emptyFormState(): FormState {
  return { ...emptyAssetDraft(), editingId: null };
}

export function AssetManager({
  assets,
  cves,
}: {
  assets: Asset[];
  cves: CveRecord[];
}) {
  const [localAssets, setLocalAssets] = React.useState(assets);

  React.useEffect(() => {
    queueMicrotask(() => {
      setLocalAssets(assets);
    });
  }, [assets]);

  const [form, setForm] = React.useState<FormState>(() => emptyFormState());
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  const isEditing = form.editingId !== null;

  const resetForm = React.useCallback(() => {
    setForm(emptyFormState());
    setFormError(null);
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const draft: AssetDraft = {
      label: form.label,
      vendor: form.vendor,
      product: form.product,
      version: form.version,
      cpeType: form.cpeType,
      environment: form.environment,
      notes: form.notes,
    };
    const error = validateDraft(draft);
    if (error) {
      setFormError(error);
      return;
    }
    setPending(true);
    try {
      if (form.editingId) {
        const result = await updateAssetAction(form.editingId, draft);
        if (!result.ok) {
          setFormError(result.error);
          return;
        }
        setLocalAssets((prev) =>
          prev.map((a) => (a.id === result.asset.id ? result.asset : a)),
        );
        setFeedback({ kind: "success", message: `Updated ${draft.product}.` });
      } else {
        const result = await createAssetAction(draft);
        if (!result.ok) {
          setFormError(result.error);
          return;
        }
        setLocalAssets((prev) => [result.asset, ...prev]);
        setFeedback({ kind: "success", message: `Added ${draft.product}.` });
      }
      resetForm();
    } finally {
      setPending(false);
    }
  };

  const beginEdit = (asset: Asset) => {
    setForm({
      editingId: asset.id,
      label: asset.label,
      vendor: asset.vendor,
      product: asset.product,
      version: asset.version,
      cpeType: asset.cpeType,
      environment: asset.environment,
      notes: asset.notes ?? "",
    });
    setFormError(null);
    setFeedback(null);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleDelete = async (asset: Asset) => {
    if (
      !window.confirm(
        `Delete asset "${asset.label || `${asset.vendor} ${asset.product}`}"? This cannot be undone.`,
      )
    ) {
      return;
    }
    setPending(true);
    try {
      const result = await deleteAssetAction(asset.id);
      if (!result.ok) {
        setFeedback({ kind: "error", message: result.error });
        return;
      }
      if (form.editingId === asset.id) {
        resetForm();
      }
      setLocalAssets((prev) => prev.filter((a) => a.id !== asset.id));
      setFeedback({ kind: "success", message: `Removed ${asset.product}.` });
    } finally {
      setPending(false);
    }
  };

  const handleExport = () => {
    const blob = exportAssetsBlob(localAssets);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `pocwatch-assets-${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
    mode: "merge" | "replace" = "merge",
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    try {
      const text = await file.text();
      const data = JSON.parse(text) as unknown;
      const result = await importAssetsAction(data, mode);
      if (!result.ok) {
        setFeedback({ kind: "error", message: result.error });
        return;
      }
      setFeedback({
        kind: "success",
        message: `Imported ${result.added} asset${result.added === 1 ? "" : "s"}${
          result.skipped > 0 ? ` (${result.skipped} skipped)` : ""
        }.`,
      });
      setLocalAssets(result.assets);
    } catch (error) {
      console.error("Asset import failed:", error);
      setFeedback({
        kind: "error",
        message:
          error instanceof Error ? error.message : "Could not parse the file.",
      });
    }
  };

  const { typeSegments, envSegments } = React.useMemo(() => {
    const byType: Record<string, number> = {};
    const byEnv: Record<string, number> = {};
    for (const type of ASSET_CPE_TYPES) byType[type] = 0;
    for (const env of ASSET_ENVIRONMENTS) byEnv[env] = 0;
    for (const asset of localAssets) {
      byType[asset.cpeType] = (byType[asset.cpeType] ?? 0) + 1;
      byEnv[asset.environment] = (byEnv[asset.environment] ?? 0) + 1;
    }
    const types: PieSegment[] = ASSET_CPE_TYPES.map((type, index) => ({
      label: formatCpeType(type),
      value: byType[type] ?? 0,
      color: `var(--chart-${index + 1})`,
    }));
    const envs: PieSegment[] = ASSET_ENVIRONMENTS.map((env, index) => ({
      label: env,
      value: byEnv[env] ?? 0,
      color: `var(--chart-${index + 1})`,
    }));
    return { typeSegments: types, envSegments: envs };
  }, [localAssets]);

  const matchingCveCount = React.useMemo(() => {
    if (localAssets.length === 0 || cves.length === 0) {
      return 0;
    }
    let count = 0;
    for (const cve of cves) {
      if (matchCveToAssets(cve, localAssets).length > 0) {
        count += 1;
      }
    }
    return count;
  }, [localAssets, cves]);

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Total Assets</CardDescription>
          </CardHeader>
          <CardContent className="flex h-[88px] items-center justify-center">
            <span className="text-5xl font-semibold tabular-nums tracking-tight">
              {localAssets.length}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Matching CVEs</CardDescription>
          </CardHeader>
          <CardContent className="flex h-[88px] items-center justify-center gap-3">
            <span
              className={cn(
                "text-5xl font-semibold tabular-nums tracking-tight",
                matchingCveCount > 0 && "text-primary",
              )}
            >
              {matchingCveCount}
            </span>
            {cves.length > 0 ? (
              <span className="text-xs leading-tight text-muted-foreground">
                of {cves.length}
                <br />
                in feed
              </span>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>By Type</CardDescription>
          </CardHeader>
          <CardContent className="flex h-[88px] items-center justify-center gap-4">
            <PieChart
              segments={typeSegments}
              size={88}
              className="shrink-0"
            />
            <PieLegend segments={typeSegments} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>By Environment</CardDescription>
          </CardHeader>
          <CardContent className="flex h-[88px] items-center justify-center gap-4">
            <PieChart
              segments={envSegments}
              size={88}
              className="shrink-0"
            />
            <PieLegend segments={envSegments} />
          </CardContent>
        </Card>
      </section>

      <Separator />

      {feedback ? (
        <Alert
          variant={feedback.kind === "error" ? "destructive" : "default"}
          className="flex items-start justify-between gap-2"
        >
          <div>
            <AlertTitle>
              {feedback.kind === "error" ? "Something went wrong" : "Done"}
            </AlertTitle>
            <AlertDescription>{feedback.message}</AlertDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Dismiss"
            onClick={() => setFeedback(null)}
            className="size-7"
          >
            <X className="size-4" />
          </Button>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {isEditing ? "Edit asset" : "Add an asset"}
          </CardTitle>
          <CardDescription>
            Define software you run so the dashboard can prioritize matching CVEs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            ref={formRef}
            onSubmit={(event) => void handleSubmit(event)}
            className="grid gap-4 md:grid-cols-2"
          >
            <div className="md:col-span-2">
              <label className={FIELD_LABEL} htmlFor="asset-label">
                Label / hostname (optional)
              </label>
              <Input
                id="asset-label"
                value={form.label}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, label: event.target.value }))
                }
                placeholder="prod-web-01"
              />
            </div>

            <div>
              <label className={FIELD_LABEL} htmlFor="asset-vendor">
                Vendor *
              </label>
              <Input
                id="asset-vendor"
                value={form.vendor}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, vendor: event.target.value }))
                }
                placeholder="nginx"
                required
              />
            </div>

            <div>
              <label className={FIELD_LABEL} htmlFor="asset-product">
                Product *
              </label>
              <Input
                id="asset-product"
                value={form.product}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, product: event.target.value }))
                }
                placeholder="nginx"
                required
              />
            </div>

            <div>
              <label className={FIELD_LABEL} htmlFor="asset-version">
                Version (optional)
              </label>
              <Input
                id="asset-version"
                value={form.version}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, version: event.target.value }))
                }
                placeholder="1.24.0"
              />
            </div>

            <div>
              <label className={FIELD_LABEL} htmlFor="asset-type">
                Type
              </label>
              <Select
                value={form.cpeType}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    cpeType: value as AssetDraft["cpeType"],
                  }))
                }
              >
                <SelectTrigger id="asset-type" className="capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_CPE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {formatCpeType(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className={FIELD_LABEL} htmlFor="asset-env">
                Environment
              </label>
              <Select
                value={form.environment}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    environment: value as AssetDraft["environment"],
                  }))
                }
              >
                <SelectTrigger id="asset-env" className="capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_ENVIRONMENTS.map((env) => (
                    <SelectItem key={env} value={env} className="capitalize">
                      {env}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <label className={FIELD_LABEL} htmlFor="asset-notes">
                Notes (optional)
              </label>
              <Input
                id="asset-notes"
                value={form.notes ?? ""}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, notes: event.target.value }))
                }
                placeholder="Internet-facing, behind Cloudflare…"
              />
            </div>

            {formError ? (
              <div className="md:col-span-2">
                <Alert variant="destructive">
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              </div>
            ) : null}

            <div className="md:col-span-2 flex flex-wrap items-center gap-2">
              <Button type="submit" className="gap-2" disabled={pending}>
                <Plus className="size-4" />
                {isEditing ? "Save changes" : "Add asset"}
              </Button>
              {isEditing ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={resetForm}
                  className="gap-2"
                >
                  <X className="size-4" />
                  Cancel edit
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg">Inventory</CardTitle>
            <CardDescription>
              Edit, delete, or export your inventory. Data is stored in the PoCWatch
              SQLite database on the server.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => handleImportFile(event)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleImportClick}
              className="gap-1.5"
            >
              <Upload className="size-3.5" />
              Import JSON
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={localAssets.length === 0}
              className="gap-1.5"
            >
              <Download className="size-3.5" />
              Export JSON
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {localAssets.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-md border border-dashed p-8 text-center">
              <Server className="size-8 text-muted-foreground" />
              <div>
                <p className="font-medium">No assets yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add software you run above, then head to the dashboard to see
                  CVEs that match your stack.
                </p>
              </div>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {localAssets.map((asset) => (
                <li
                  key={asset.id}
                  className={cn(
                    "flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between",
                    form.editingId === asset.id && "ring-2 ring-primary",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {asset.label ? asset.label : `${asset.vendor} ${asset.product}`}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {formatCpeType(asset.cpeType)}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] capitalize">
                        {asset.environment}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      <span className="capitalize">{asset.vendor}</span>{" "}
                      <span className="capitalize">{asset.product}</span>{" "}
                      <span className="font-mono">
                        {asset.version || "(any version)"}
                      </span>
                      <span className="ml-2 opacity-70">
                        added {formatDate(asset.createdAt)}
                      </span>
                    </div>
                    {asset.notes ? (
                      <p className="mt-1 text-xs text-muted-foreground italic">
                        {asset.notes}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => beginEdit(asset)}
                      disabled={pending}
                      className="gap-1.5"
                    >
                      <Pencil className="size-3.5" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleDelete(asset)}
                      disabled={pending}
                      className="gap-1.5 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
