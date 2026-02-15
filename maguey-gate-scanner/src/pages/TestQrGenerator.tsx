import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import QRCode from "qrcode";

const textEncoder = new TextEncoder();

async function generateSignature(token: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    textEncoder.encode(token)
  );

  // Convert to base64
  let binary = "";
  const bytes = new Uint8Array(signatureBuffer);
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

interface Ticket {
  ticket_id: string;
  guest_name: string | null;
  event_name: string;
  is_used: boolean;
}

const TestQrGenerator = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<string>("");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [payload, setPayload] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Load tickets on mount
  useEffect(() => {
    const loadTickets = async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("ticket_id, guest_name, event_name, is_used")
        .eq("is_used", false)
        .limit(10);

      if (!error && data) {
        setTickets(data);
        if (data.length > 0) {
          setSelectedTicket(data[0].ticket_id);
        }
      }
    };
    loadTickets();
  }, []);

  const generateQr = async () => {
    if (!selectedTicket) return;

    setLoading(true);
    try {
      const secret = import.meta.env.VITE_QR_SIGNING_SECRET;
      if (!secret) {
        alert("VITE_QR_SIGNING_SECRET not configured!");
        return;
      }

      const signature = await generateSignature(selectedTicket, secret);
      const qrPayload = JSON.stringify({
        token: selectedTicket,
        signature: signature,
        meta: null,
      });

      setPayload(qrPayload);

      const dataUrl = await QRCode.toDataURL(qrPayload, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 300,
      });

      setQrDataUrl(dataUrl);
    } catch (error) {
      console.error("Error generating QR:", error);
      alert("Error generating QR code");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-md mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Test QR Code Generator</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Select Ticket</Label>
              <Select value={selectedTicket} onValueChange={setSelectedTicket}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a ticket" />
                </SelectTrigger>
                <SelectContent>
                  {tickets.map((t) => (
                    <SelectItem key={t.ticket_id} value={t.ticket_id}>
                      {t.ticket_id.slice(0, 20)}... - {t.guest_name || "No name"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={generateQr} disabled={loading || !selectedTicket} className="w-full">
              {loading ? "Generating..." : "Generate QR Code"}
            </Button>
          </CardContent>
        </Card>

        {qrDataUrl && (
          <Card>
            <CardHeader>
              <CardTitle>Scan This QR Code</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-4">
              <img src={qrDataUrl} alt="QR Code" className="border-4 border-white rounded-lg" />
              <p className="text-sm text-muted-foreground text-center">
                Open the Scanner, go to QR Camera tab, and scan this code
              </p>
              <div className="w-full">
                <Label>Payload (for manual testing)</Label>
                <textarea
                  className="w-full h-24 text-xs p-2 bg-muted rounded font-mono"
                  readOnly
                  value={payload}
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TestQrGenerator;
