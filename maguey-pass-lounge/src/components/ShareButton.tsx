import { useState } from "react";
import { Share2, Link2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ShareButtonProps {
  url: string;
  title: string;
  text?: string;
  /** Use dark variant for dark backgrounds (e.g. CheckoutSuccess) */
  variant?: "light" | "dark";
}

const ShareButton = ({ url, title, text, variant = "light" }: ShareButtonProps) => {
  const [copied, setCopied] = useState(false);

  const shareData = { url, title, text: text || title };

  const handleNativeShare = async () => {
    try {
      await navigator.share(shareData);
    } catch {
      // User cancelled or share failed
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = url;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(text || title);

  const btnClass = variant === "dark"
    ? "border-white/20 text-stone-300 hover:bg-white/10"
    : "bg-gray-100 hover:bg-gray-200 text-foreground";

  // Use native Web Share API on supported devices (mobile)
  if (typeof navigator !== "undefined" && navigator.share) {
    return (
      <Button variant="outline" onClick={handleNativeShare} className={`gap-2 ${btnClass}`}>
        <Share2 className="w-4 h-4" />
        Share
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={handleCopyLink} className={`gap-1.5 ${btnClass}`}>
        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Link2 className="w-4 h-4" />}
        {copied ? "Copied!" : "Copy Link"}
      </Button>
      <Button variant="outline" size="sm" asChild className={btnClass}>
        <a
          href={`https://wa.me/?text=${encodedText}%20${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          WhatsApp
        </a>
      </Button>
      <Button variant="outline" size="sm" asChild className={btnClass}>
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Facebook
        </a>
      </Button>
      <Button variant="outline" size="sm" asChild className={btnClass}>
        <a
          href={`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          X / Twitter
        </a>
      </Button>
    </div>
  );
};

export default ShareButton;
