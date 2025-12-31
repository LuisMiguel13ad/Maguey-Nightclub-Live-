/**
 * Bulk Guest Import Component
 * 
 * Allows importing multiple guests at once via text paste or CSV.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { addGuestsBulk } from '@/lib/guest-list-service';
import { isOk } from '@/lib/result';
import { toast } from 'sonner';
import { Loader2, Upload, FileText } from 'lucide-react';

interface BulkGuestImportProps {
  guestListId: string;
  onSuccess?: (result: { added: number; duplicates: number }) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface ParsedGuest {
  guestName: string;
  plusOnes: number;
  notes?: string;
}

/**
 * Parse guest names from text input
 * Supports formats:
 * - "Name"
 * - "Name +2"
 * - "Name, +2, VIP birthday"
 * - "Name +2 VIP birthday"
 */
function parseGuestText(text: string): ParsedGuest[] {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.map((line) => {
    // Try to extract plus ones (e.g., "+2", "+ 2", "plus 2")
    const plusOnesMatch = line.match(/\+(\d+)|plus\s+(\d+)/i);
    const plusOnes = plusOnesMatch
      ? parseInt(plusOnesMatch[1] || plusOnesMatch[2]) || 0
      : 0;

    // Remove plus ones from name
    let name = line.replace(/\+(\d+)|plus\s+\d+/gi, '').trim();

    // Try to extract notes (comma-separated or after name)
    let notes: string | undefined;
    const commaParts = name.split(',').map((p) => p.trim());
    if (commaParts.length > 1) {
      name = commaParts[0];
      notes = commaParts.slice(1).join(', ');
    }

    // Clean up name (remove extra spaces)
    name = name.replace(/\s+/g, ' ').trim();

    return {
      guestName: name,
      plusOnes,
      notes: notes || undefined,
    };
  });
}

export function BulkGuestImport({
  guestListId,
  onSuccess,
  open,
  onOpenChange,
}: BulkGuestImportProps) {
  const [isOpen, setIsOpen] = useState(open ?? false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [preview, setPreview] = useState<ParsedGuest[]>([]);

  const handleOpenChange = (newOpen: boolean) => {
    setIsOpen(newOpen);
    onOpenChange?.(newOpen);
    if (!newOpen) {
      setTextInput('');
      setPreview([]);
    }
  };

  const handleTextChange = (value: string) => {
    setTextInput(value);
    if (value.trim()) {
      const parsed = parseGuestText(value);
      setPreview(parsed.slice(0, 10)); // Show first 10 as preview
    } else {
      setPreview([]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      handleTextChange(content);
    };
    reader.readAsText(file);
  };

  const handleSubmit = async () => {
    if (!textInput.trim()) {
      toast.error('Please enter guest names');
      return;
    }

    const guests = parseGuestText(textInput);
    if (guests.length === 0) {
      toast.error('No valid guests found');
      return;
    }

    setIsSubmitting(true);

    try {
      // Get current user for added_by_name
      const { data: userData } = await import('@/lib/supabase').then((m) => m.supabase.auth.getUser());
      const addedByName = userData.user?.email || 'Admin';

      const result = await addGuestsBulk(guestListId, guests, addedByName);

      if (isOk(result)) {
        toast.success(
          `Added ${result.data.added} guests${result.data.duplicates > 0 ? ` (${result.data.duplicates} duplicates skipped)` : ''}`
        );
        handleOpenChange(false);
        onSuccess?.(result.data);
      } else {
        toast.error(result.error.message);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to import guests');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalGuests = parseGuestText(textInput).length;
  const totalPlusOnes = parseGuestText(textInput).reduce((sum, g) => sum + g.plusOnes, 0);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Import Guests</DialogTitle>
          <DialogDescription>
            Paste guest names (one per line) or upload a CSV file. Supports formats like "Name +2" or "Name, +2, Notes".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File Upload */}
          <div className="space-y-2">
            <Label>Upload CSV File (Optional)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-upload"
              />
              <Label
                htmlFor="csv-upload"
                className="flex items-center gap-2 px-4 py-2 border rounded-md cursor-pointer hover:bg-accent"
              >
                <Upload className="w-4 h-4" />
                Choose File
              </Label>
              <span className="text-sm text-muted-foreground">or paste names below</span>
            </div>
          </div>

          {/* Text Input */}
          <div className="space-y-2">
            <Label htmlFor="guestNames">
              Guest Names <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="guestNames"
              value={textInput}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder={`John Doe
Jane Smith +2
Bob Johnson, +1, VIP
Alice Williams +3 Birthday`}
              rows={10}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              One name per line. Use "+2" for plus ones, comma for notes.
            </p>
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Preview</CardTitle>
                <CardDescription>
                  Showing first {preview.length} of {totalGuests} guests
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {preview.map((guest, idx) => (
                    <div key={idx} className="text-sm border-b pb-2">
                      <div className="font-medium">{guest.guestName}</div>
                      {guest.plusOnes > 0 && (
                        <div className="text-muted-foreground">+{guest.plusOnes} guests</div>
                      )}
                      {guest.notes && (
                        <div className="text-muted-foreground text-xs">{guest.notes}</div>
                      )}
                    </div>
                  ))}
                </div>
                {totalGuests > 10 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    ... and {totalGuests - 10} more
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Summary */}
          {totalGuests > 0 && (
            <div className="flex gap-4 text-sm">
              <div>
                <span className="font-medium">Total Guests:</span> {totalGuests}
              </div>
              {totalPlusOnes > 0 && (
                <div>
                  <span className="font-medium">Total Plus Ones:</span> {totalPlusOnes}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || totalGuests === 0}>
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Import {totalGuests > 0 ? `${totalGuests} Guest${totalGuests !== 1 ? 's' : ''}` : 'Guests'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Standalone trigger button
export function BulkImportButton({
  guestListId,
  onSuccess,
}: {
  guestListId: string;
  onSuccess?: (result: { added: number; duplicates: number }) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setIsOpen(true)}>
        <FileText className="w-4 h-4 mr-2" />
        Bulk Import
      </Button>
      <BulkGuestImport
        guestListId={guestListId}
        onSuccess={onSuccess}
        open={isOpen}
        onOpenChange={setIsOpen}
      />
    </>
  );
}

// Fix missing Input import
import { Input } from '@/components/ui/input';
