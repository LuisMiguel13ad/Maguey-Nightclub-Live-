import { useState } from "react";
import { Share2, Link2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ShareButtonProps {
  url: string;
  title: string;
  text?: string;
}

const ShareButton = ({ url, title, text }: ShareButtonProps) => {
  const [copied, setCopied] = useState(false);

  const shareData = { url, title, text: text || title };

  const handleNativeShare = async () => {
    try {
      await navigator.share(shareData);
    } catch {
      // User cancelled or share failed — no-op
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
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

  // Use native Web Share API on supported devices (mobile)
  if (typeof navigator !== "undefined" && navigator.share) {
    return (
      <Button
        variant="outline"
        onClick={handleNativeShare}
        className="border-white/20 text-white hover:bg-white/10 gap-2"
      >
        <Share2 className="w-4 h-4" />
        Share
      </Button>
    );
  }

  // Fallback: individual platform buttons
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleCopyLink}
        className="border-white/20 text-white hover:bg-white/10 gap-1.5"
      >
        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Link2 className="w-4 h-4" />}
        {copied ? "Copied!" : "Copy Link"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        asChild
        className="border-white/20 text-white hover:bg-white/10"
      >
        <a
          href={`https://wa.me/?text=${encodedText}%20${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          WhatsApp
        </a>
      </Button>
      <Button
        variant="outline"
        size="sm"
        asChild
        className="border-white/20 text-white hover:bg-white/10"
      >
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Facebook
        </a>
      </Button>
      <Button
        variant="outline"
        size="sm"
        asChild
        className="border-white/20 text-white hover:bg-white/10"
      >
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
