"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader, IScannerControls } from "@zxing/browser";
import { Camera, Keyboard, ScanLine } from "lucide-react";

type Result = {
  result: "valid" | "already_used" | "cancelled" | "refunded" | "invalid";
  ticket_number?: string;
  event_name?: string;
  ticket_type?: string;
  customer?: string;
  checked_in_at?: string;
  checked_in_by?: string;
};

type CameraState = "idle" | "starting" | "active" | "denied" | "unavailable" | "error";

const cameraMessages: Record<Exclude<CameraState, "active">, string> = {
  idle: "Camera preview",
  starting: "Starting camera...",
  denied: "Camera access was denied. You can still use manual lookup.",
  unavailable: "No camera is available on this device.",
  error: "We couldn't start the camera. You can still use manual lookup.",
};

export function TicketScanner() {
  const video = useRef<HTMLVideoElement>(null);
  const controls = useRef<IScannerControls | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const cameraRequest = useRef(0);
  const scanPaused = useRef(false);
  const busyRef = useRef(false);
  const mounted = useRef(true);
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [value, setValue] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  const releaseCamera = useCallback(() => {
    cameraRequest.current += 1;
    controls.current?.stop();
    controls.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    scanPaused.current = false;

    if (video.current) {
      video.current.pause();
      video.current.srcObject = null;
    }
  }, []);

  function stopCamera() {
    releaseCamera();
    setCameraState("idle");
  }

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      releaseCamera();
    };
  }, [releaseCamera]);

  async function lookup(raw: string, checkIn = false) {
    if (!raw || busyRef.current) return;

    busyRef.current = true;
    setBusy(true);

    try {
      const response = await fetch("/api/admin/scanner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: raw, checkIn }),
      });
      const data = await response.json();
      setResult(data);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function startCamera() {
    if (cameraState === "starting" || cameraState === "active" || stream.current) return;

    const requestId = cameraRequest.current + 1;
    cameraRequest.current = requestId;
    scanPaused.current = false;
    setResult(null);
    setCameraState("starting");

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState("unavailable");
      return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });

      if (!mounted.current || cameraRequest.current !== requestId) {
        mediaStream.getTracks().forEach((track) => track.stop());
        return;
      }

      const preview = video.current;
      if (!preview) {
        mediaStream.getTracks().forEach((track) => track.stop());
        throw new Error("Camera preview is unavailable");
      }

      stream.current = mediaStream;
      preview.srcObject = mediaStream;
      await preview.play();

      const reader = new BrowserQRCodeReader();
      const scannerControls = await reader.decodeFromStream(mediaStream, preview, (scan) => {
        if (!scan || scanPaused.current) return;
        scanPaused.current = true;
        void lookup(scan.getText());
      });

      if (!mounted.current || cameraRequest.current !== requestId) {
        scannerControls.stop();
        mediaStream.getTracks().forEach((track) => track.stop());
        return;
      }

      controls.current = scannerControls;
      setCameraState("active");
    } catch (error) {
      if (!mounted.current || cameraRequest.current !== requestId) return;
      releaseCamera();

      const errorName = error instanceof DOMException ? error.name : "";
      if (errorName === "NotAllowedError" || errorName === "SecurityError") {
        setCameraState("denied");
      } else if (
        errorName === "NotFoundError" ||
        errorName === "DevicesNotFoundError" ||
        errorName === "OverconstrainedError"
      ) {
        setCameraState("unavailable");
      } else {
        setCameraState("error");
      }
    }
  }

  const label =
    result?.result === "valid"
      ? "VALID TICKET"
      : result?.result === "already_used"
        ? "ALREADY USED"
        : result?.result?.toUpperCase();
  const cameraActive = cameraState === "active";
  const cameraStarting = cameraState === "starting";
  const cameraMessage = cameraState === "active" ? null : cameraMessages[cameraState];

  return (
    <div className="scanner-layout">
      <section className="scanner-camera">
        <div className="scanner-viewport">
          <video
            ref={video}
            autoPlay
            playsInline
            muted
            className={cameraActive ? "is-active" : undefined}
          />
          {cameraMessage && (
            <div role="status" aria-live="polite">
              <ScanLine />
              <p>{cameraMessage}</p>
            </div>
          )}
          <span />
        </div>
        <button
          className="admin-primary-button"
          disabled={cameraStarting}
          onClick={cameraActive ? stopCamera : startCamera}
        >
          <Camera />
          {cameraActive ? "STOP CAMERA" : cameraStarting ? "Starting camera..." : "SCAN WITH CAMERA"}
        </button>
      </section>
      <section className="scanner-manual">
        <h2>
          <Keyboard />Manual lookup
        </h2>
        <p>Enter a ticket number, secure token, or paste the complete QR URL.</p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            lookup(value);
          }}
        >
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="GOOM-MICH-000001"
          />
          <button className="admin-secondary-button" disabled={busy}>
            Find ticket
          </button>
        </form>
        {result && (
          <div className={`scan-result ${result.result}`}>
            <span>{label}</span>
            {result.ticket_number && (
              <>
                <h3>{result.ticket_number}</h3>
                <p>
                  <strong>{result.event_name}</strong>
                  <br />
                  {result.ticket_type}
                  <br />
                  {result.customer}
                </p>
              </>
            )}
            {result.result === "valid" && (
              <button
                className="admin-primary-button"
                disabled={busy}
                onClick={() => lookup(value || result.ticket_number || "", true)}
              >
                Check in
              </button>
            )}
            {result.result === "already_used" && (
              <p>
                Checked in {result.checked_in_at ? new Date(result.checked_in_at).toLocaleString() : "previously"}
                <br />
                {result.checked_in_by || "Administrator"}
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
