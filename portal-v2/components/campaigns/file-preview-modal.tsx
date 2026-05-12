"use client";

import { useState, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { FileText, X, Download, ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

interface Asset {
  id: string;
  fileName: string;
  fileUrl: string;
  category: string;
}

function isPdf(fileName: string) {
  return fileName.toLowerCase().endsWith(".pdf");
}

function isImage(fileName: string) {
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(fileName);
}

export default function FilePreviewModal({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfError, setPdfError] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 860, height: 580 });
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pdf = isPdf(asset.fileName);
  const image = isImage(asset.fileName);

  useEffect(() => {
    if (!contentRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ width, height });
    });
    ro.observe(contentRef.current);
    return () => ro.disconnect();
  }, []);

  const fitScale = pageSize
    ? Math.min(
        (containerSize.width - 32) / pageSize.width,
        (containerSize.height - 16) / pageSize.height
      )
    : 1;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (pdf && !pdfError) {
        if (e.key === "ArrowLeft") setCurrentPage((p) => Math.max(1, p - 1));
        if (e.key === "ArrowRight") setCurrentPage((p) => Math.min(numPages ?? p, p + 1));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, pdf, pdfError, numPages]);

  const resolvedUrl = asset.fileUrl.startsWith("http")
    ? `/api/document-proxy?url=${encodeURIComponent(asset.fileUrl)}`
    : asset.fileUrl;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`relative flex flex-col bg-white shadow-2xl overflow-hidden transition-all duration-200 ${fullscreen ? "rounded-none" : "rounded-2xl"}`}
        style={fullscreen ? { width: "100vw", height: "100vh" } : { width: "min(900px, 94vw)", height: "min(680px, 88vh)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-5 py-2.5 border-b border-border bg-surface shrink-0">
          <span className="text-xs font-medium text-text-secondary truncate">{asset.fileName}</span>
          <div className="flex items-center gap-1 shrink-0">
            <a
              href={asset.fileUrl}
              download={asset.fileName}
              className="flex items-center justify-center h-7 w-7 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition-colors"
              title="Download"
            >
              <Download className="h-3.5 w-3.5" />
            </a>
            <button
              onClick={() => setFullscreen((f) => !f)}
              className="flex items-center justify-center h-7 w-7 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition-colors"
              title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={onClose}
              className="flex items-center justify-center h-7 w-7 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div
          ref={contentRef}
          className="flex-1 overflow-hidden bg-surface-secondary flex items-center justify-center"
        >
          {image ? (
            <div className="flex items-center justify-center h-full w-full p-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset.fileUrl}
                alt={asset.fileName}
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            </div>
          ) : pdf ? (
            pdfError ? (
              <div className="flex flex-col items-center gap-4 p-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface">
                  <FileText className="h-8 w-8 text-text-tertiary" />
                </div>
                <div>
                  <p className="font-medium text-text-primary">Preview unavailable</p>
                  <p className="text-sm text-text-secondary mt-1">This file couldn&apos;t be loaded</p>
                </div>
                <a
                  href={asset.fileUrl}
                  download={asset.fileName}
                  className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
                >
                  Download
                </a>
              </div>
            ) : (
              <Document
                file={resolvedUrl}
                onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                onLoadError={() => setPdfError(true)}
                loading={
                  <div className="flex items-center justify-center h-full text-text-tertiary">
                    <span className="text-sm">Loading...</span>
                  </div>
                }
                className="flex items-center justify-center"
              >
                <Page
                  pageNumber={currentPage}
                  scale={fitScale ?? 1}
                  onLoadSuccess={(page) => {
                    const vp = page.getViewport({ scale: 1 });
                    setPageSize({ width: vp.width, height: vp.height });
                  }}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  className="shadow-lg rounded"
                />
              </Document>
            )
          ) : (
            <div className="flex flex-col items-center gap-4 p-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface">
                <FileText className="h-8 w-8 text-text-tertiary" />
              </div>
              <div>
                <p className="font-medium text-text-primary">Preview unavailable</p>
                <p className="text-sm text-text-secondary mt-1">This file type can&apos;t be previewed</p>
              </div>
              <a
                href={asset.fileUrl}
                download={asset.fileName}
                className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
              >
                Download
              </a>
            </div>
          )}
        </div>

        {pdf && !pdfError && (
          <div className="flex items-center justify-center gap-3 px-5 py-2 border-t border-border bg-surface shrink-0">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center justify-center h-6 w-6 rounded text-text-secondary hover:text-text-primary hover:bg-surface-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs text-text-tertiary min-w-[60px] text-center">
              {numPages ? `${currentPage} / ${numPages}` : currentPage}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(numPages ?? p, p + 1))}
              disabled={numPages !== null && currentPage >= numPages}
              className="flex items-center justify-center h-6 w-6 rounded text-text-secondary hover:text-text-primary hover:bg-surface-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
