import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Hash, User, Mail, Phone } from "lucide-react";

interface ManualEntryProps {
  onSubmit: (searchData: { method: string; values: Record<string, string> }) => void;
  disabled?: boolean;
}

export const ManualEntry = ({ onSubmit, disabled = false }: ManualEntryProps) => {
  const [activeTab, setActiveTab] = useState("ticket-id");
  
  // Ticket ID method
  const [ticketId, setTicketId] = useState("");
  
  // Name method
  const [guestName, setGuestName] = useState("");
  
  // Email method
  const [guestEmail, setGuestEmail] = useState("");
  
  // Phone method
  const [phoneNumber, setPhoneNumber] = useState("");

  const handleTicketIdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ticketId.trim()) {
      onSubmit({
        method: "ticket-id",
        values: { ticket_id: ticketId.trim() },
      });
      setTicketId("");
    }
  };

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (guestName.trim()) {
      onSubmit({
        method: "name-event",
        values: { guest_name: guestName.trim() },
      });
      setGuestName("");
    }
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (guestEmail.trim()) {
      onSubmit({
        method: "email-event",
        values: { guest_email: guestEmail.trim().toLowerCase() },
      });
      setGuestEmail("");
    }
  };

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneNumber.trim()) {
      // Remove non-digit characters from phone
      const cleanedPhone = phoneNumber.replace(/\D/g, "");
      onSubmit({
        method: "phone-event",
        values: { phone_number: cleanedPhone },
      });
      setPhoneNumber("");
    }
  };

  return (
    <Card className="border-accent/20">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Hash className="h-5 w-5 text-accent" />
          Manual Verification
        </CardTitle>
        <CardDescription>
          Verify tickets using alternative methods when QR scanning fails
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="ticket-id" className="text-xs">
              <Hash className="h-3 w-3 mr-1" />
              ID
            </TabsTrigger>
            <TabsTrigger value="name" className="text-xs">
              <User className="h-3 w-3 mr-1" />
              Name
            </TabsTrigger>
            <TabsTrigger value="email" className="text-xs">
              <Mail className="h-3 w-3 mr-1" />
              Email
            </TabsTrigger>
            <TabsTrigger value="phone" className="text-xs">
              <Phone className="h-3 w-3 mr-1" />
              Phone
            </TabsTrigger>
          </TabsList>

          {/* Ticket ID Method */}
          <TabsContent value="ticket-id" className="space-y-4 mt-4">
            <form onSubmit={handleTicketIdSubmit} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="ticket-id">Ticket ID or QR Token</Label>
                <Input
                  id="ticket-id"
                  placeholder="MGY-2025-001 or QR token"
                  value={ticketId}
                  onChange={(e) => setTicketId(e.target.value)}
                  className="border-accent/20 focus:border-accent"
                  disabled={disabled}
                  autoFocus
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-gradient-gold hover:shadow-glow-gold transition-all"
                disabled={disabled || !ticketId.trim()}
              >
                Verify by Ticket ID
              </Button>
            </form>
          </TabsContent>

          {/* Name Method */}
          <TabsContent value="name" className="space-y-4 mt-4">
            <form onSubmit={handleNameSubmit} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="guest-name">Guest Name</Label>
                <Input
                  id="guest-name"
                  placeholder="John Doe"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="border-accent/20 focus:border-accent"
                  disabled={disabled}
                  autoFocus
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-gradient-gold hover:shadow-glow-gold transition-all"
                disabled={disabled || !guestName.trim()}
              >
                Verify by Name
              </Button>
            </form>
          </TabsContent>

          {/* Email Method */}
          <TabsContent value="email" className="space-y-4 mt-4">
            <form onSubmit={handleEmailSubmit} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="guest-email">Guest Email</Label>
                <Input
                  id="guest-email"
                  type="email"
                  placeholder="guest@example.com"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  className="border-accent/20 focus:border-accent"
                  disabled={disabled}
                  autoFocus
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-gradient-gold hover:shadow-glow-gold transition-all"
                disabled={disabled || !guestEmail.trim()}
              >
                Verify by Email
              </Button>
            </form>
          </TabsContent>

          {/* Phone Method */}
          <TabsContent value="phone" className="space-y-4 mt-4">
            <form onSubmit={handlePhoneSubmit} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="phone-number">Phone Number</Label>
                <Input
                  id="phone-number"
                  type="tel"
                  placeholder="(555) 123-4567 or 5551234567"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="border-accent/20 focus:border-accent"
                  disabled={disabled}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Enter phone number with or without formatting
                </p>
              </div>
              <Button
                type="submit"
                className="w-full bg-gradient-gold hover:shadow-glow-gold transition-all"
                disabled={disabled || !phoneNumber.trim()}
              >
                Verify by Phone
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
