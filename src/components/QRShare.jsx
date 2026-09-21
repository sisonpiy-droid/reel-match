import { useEffect, useState } from "react";
import QRCode from "qrcode";

// Renders the join link as a QR code and, where supported, lets Partner A
// share it as an actual image via the OS share sheet (spec: "share the QR
// code as an image directly from the app to any messaging app"). Falls back
// to copying the link when Web Share (or file-sharing) isn't available --
// desktop Chrome, mostly.
export default function QRShare({ url }) {
  const [dataUrl, setDataUrl] = useState(null);
  const [copyState, setCopyState] = useState("idle");

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { width: 480, margin: 2, color: { dark: "#12121a", light: "#ffffff" } }).then((d) => {
      if (!cancelled) setDataUrl(d);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  async function share() {
    try {
      if (dataUrl && navigator.canShare) {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], "reel-match-invite.png", { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: "Pick tonight's watch with me", text: url });
          return;
        }
      }
      if (navigator.share) {
        await navigator.share({ title: "Pick tonight's watch with me", url });
        return;
      }
    } catch (e) {
      if (e?.name === "AbortError") return; // user cancelled the share sheet
    }
    await navigator.clipboard.writeText(url);
    setCopyState("copied");
    setTimeout(() => setCopyState("idle"), 2000);
  }

  return (
    <div className="qr-share">
      {dataUrl ? <img src={dataUrl} alt="QR code to join this session" className="qr-code" /> : <div className="qr-code qr-placeholder" />}
      <button type="button" className="primary-button" onClick={share}>
        {copyState === "copied" ? "Link copied!" : "Share with your partner"}
      </button>
      <p className="join-link">{url}</p>
    </div>
  );
}
