"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils/format";
import { parseCSV, type CsvCampaignRow } from "@/lib/utils/csv-parser";
import { Upload, AlertTriangle, CheckCircle2, FileSpreadsheet } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

export function CsvImportModal({ open, onClose, onImported }: Props) {
  const { toast } = useToast();
  const [rows, setRows] = useState<CsvCampaignRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{
    imported: number;
    errors: number;
    errorDetails: Array<{ row: number; wfNumber: string; error: string }>;
  } | null>(null);

  function handleFileSelect(selectedFile: File) {
    setFile(selectedFile);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      setRows(parsed.rows);
      setHeaders(parsed.headers);
    };
    reader.readAsText(selectedFile);
  }

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/campaigns/import", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Import failed");
      const data = await res.json();
      setResult(data);
      if (data.imported > 0) {
        toast("success", `${data.imported} campaign${data.imported > 1 ? "s" : ""} imported`);
        onImported();
      }
      if (data.errors > 0) {
        toast("error", `${data.errors} row${data.errors > 1 ? "s" : ""} had errors`);
      }
    } catch {
      toast("error", "Import failed");
    } finally {
      setImporting(false);
    }
  }

  function handleClose() {
    setRows([]);
    setHeaders([]);
    setFile(null);
    setResult(null);
    onClose();
  }

  const validRows = rows.filter((r) => r.errors.length === 0);
  const errorRows = rows.filter((r) => r.errors.length > 0);

  return (
    <Modal open={open} onClose={handleClose} title="Import Campaigns from CSV" size="lg">
      {rows.length === 0 ? (
        <div className="space-y-4">
          <div
            className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border p-8 text-center cursor-pointer hover:bg-surface-secondary transition-colors"
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".csv,.tsv,.txt";
              input.onchange = () => {
                const f = input.files?.[0];
                if (f) handleFileSelect(f);
              };
              input.click();
            }}
          >
            <FileSpreadsheet className="h-8 w-8 text-text-tertiary" />
            <div>
              <p className="text-sm font-medium text-text-primary">
                Drop or click to upload CSV
              </p>
              <p className="text-xs text-text-tertiary mt-1">
                Columns: WF#, Name, Brand, Budget, Shoot Dates
              </p>
            </div>
          </div>
          <ModalFooter>
            <Button variant="ghost" onClick={handleClose}>Cancel</Button>
          </ModalFooter>
        </div>
      ) : result ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg bg-surface-secondary p-4">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <div>
              <p className="text-sm font-medium text-text-primary">
                {result.imported} campaign{result.imported !== 1 ? "s" : ""} imported
              </p>
              {result.errors > 0 && (
                <p className="text-xs text-text-secondary">
                  {result.errors} row{result.errors !== 1 ? "s" : ""} had errors
                </p>
              )}
            </div>
          </div>
          {result.errorDetails.length > 0 && (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {result.errorDetails.map((err, i) => (
                <div key={i} className="flex items-start gap-2 text-xs rounded-lg bg-red-50 p-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                  <span className="text-red-700">
                    Row {err.row} ({err.wfNumber}): {err.error}
                  </span>
                </div>
              ))}
            </div>
          )}
          <ModalFooter>
            <Button onClick={handleClose}>Done</Button>
          </ModalFooter>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-secondary">
              {file?.name} · {rows.length} row{rows.length !== 1 ? "s" : ""}
            </p>
            <div className="flex gap-2">
              {validRows.length > 0 && (
                <Badge variant="custom" className="bg-emerald-50 text-emerald-700">
                  {validRows.length} valid
                </Badge>
              )}
              {errorRows.length > 0 && (
                <Badge variant="custom" className="bg-red-50 text-red-700">
                  {errorRows.length} errors
                </Badge>
              )}
            </div>
          </div>

          {/* Preview table */}
          <div className="overflow-x-auto max-h-64 overflow-y-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface-secondary">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-text-tertiary">#</th>
                  <th className="text-left px-3 py-2 font-medium text-text-tertiary">WF#</th>
                  <th className="text-left px-3 py-2 font-medium text-text-tertiary">Name</th>
                  <th className="text-left px-3 py-2 font-medium text-text-tertiary">Brand</th>
                  <th className="text-right px-3 py-2 font-medium text-text-tertiary">Budget</th>
                  <th className="text-left px-3 py-2 font-medium text-text-tertiary">Dates</th>
                  <th className="text-left px-3 py-2 font-medium text-text-tertiary">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.rowNumber}
                    className={`border-t border-border-light ${
                      row.errors.length > 0 ? "bg-red-50/50" : ""
                    }`}
                  >
                    <td className="px-3 py-2 text-text-tertiary">{row.rowNumber}</td>
                    <td className="px-3 py-2 font-mono text-text-primary">{row.wfNumber}</td>
                    <td className="px-3 py-2 text-text-primary font-medium">{row.name}</td>
                    <td className="px-3 py-2 text-text-secondary">{row.brand}</td>
                    <td className="px-3 py-2 text-right text-text-primary">
                      {formatCurrency(row.budget)}
                    </td>
                    <td className="px-3 py-2 text-text-secondary">
                      {row.shootDates.length > 0
                        ? `${row.shootDates.length} date${row.shootDates.length > 1 ? "s" : ""}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {row.errors.length > 0 ? (
                        <span className="text-red-600" title={row.errors.join(", ")}>
                          {row.errors.join(", ")}
                        </span>
                      ) : (
                        <span className="text-emerald-600">Ready</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ModalFooter>
            <Button variant="ghost" onClick={handleClose}>Cancel</Button>
            <Button
              loading={importing}
              disabled={validRows.length === 0}
              onClick={handleImport}
            >
              <Upload className="h-3.5 w-3.5" />
              Import {validRows.length} Campaign{validRows.length !== 1 ? "s" : ""}
            </Button>
          </ModalFooter>
        </div>
      )}
    </Modal>
  );
}
