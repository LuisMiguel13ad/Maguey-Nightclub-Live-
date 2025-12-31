/**
 * Add Guest Form Component
 * 
 * Form for adding individual guests to a guest list.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { addGuest, type GuestListEntry } from '@/lib/guest-list-service';
import { isOk } from '@/lib/result';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface AddGuestFormProps {
  guestListId: string;
  onSuccess?: (entry: GuestListEntry) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  quickAdd?: boolean; // Just name + plus ones
}

export function AddGuestForm({
  guestListId,
  onSuccess,
  open,
  onOpenChange,
  quickAdd = false,
}: AddGuestFormProps) {
  const [isOpen, setIsOpen] = useState(open ?? false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    guestName: '',
    guestEmail: '',
    guestPhone: '',
    plusOnes: 0,
    notes: '',
  });

  const handleOpenChange = (newOpen: boolean) => {
    setIsOpen(newOpen);
    onOpenChange?.(newOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.guestName.trim()) {
      toast.error('Guest name is required');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await addGuest(guestListId, {
        guestName: formData.guestName.trim(),
        guestEmail: formData.guestEmail.trim() || undefined,
        guestPhone: formData.guestPhone.trim() || undefined,
        plusOnes: formData.plusOnes,
        notes: formData.notes.trim() || undefined,
      });

      if (isOk(result)) {
        toast.success('Guest added successfully');
        setFormData({
          guestName: '',
          guestEmail: '',
          guestPhone: '',
          plusOnes: 0,
          notes: '',
        });
        handleOpenChange(false);
        onSuccess?.(result.data);
      } else {
        toast.error(result.error.message);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add guest');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{quickAdd ? 'Quick Add Guest' : 'Add Guest'}</DialogTitle>
          <DialogDescription>
            {quickAdd
              ? 'Add a guest with just their name and plus ones.'
              : 'Add a new guest to the list. Name is required, other fields are optional.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="guestName">
                Guest Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="guestName"
                value={formData.guestName}
                onChange={(e) => setFormData({ ...formData, guestName: e.target.value })}
                placeholder="John Doe"
                required
                autoFocus
              />
            </div>

            {!quickAdd && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="guestEmail">Email (Optional)</Label>
                  <Input
                    id="guestEmail"
                    type="email"
                    value={formData.guestEmail}
                    onChange={(e) => setFormData({ ...formData, guestEmail: e.target.value })}
                    placeholder="john@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="guestPhone">Phone (Optional)</Label>
                  <Input
                    id="guestPhone"
                    type="tel"
                    value={formData.guestPhone}
                    onChange={(e) => setFormData({ ...formData, guestPhone: e.target.value })}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="plusOnes">Plus Ones</Label>
              <Input
                id="plusOnes"
                type="number"
                min="0"
                max="10"
                value={formData.plusOnes}
                onChange={(e) => setFormData({ ...formData, plusOnes: parseInt(e.target.value) || 0 })}
              />
            </div>

            {!quickAdd && (
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Birthday girl, Industry, VIP, etc."
                  rows={3}
                />
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Guest
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Standalone trigger button component
export function AddGuestButton({
  guestListId,
  onSuccess,
  quickAdd = false,
}: {
  guestListId: string;
  onSuccess?: (entry: GuestListEntry) => void;
  quickAdd?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        {quickAdd ? 'Quick Add' : 'Add Guest'}
      </Button>
      <AddGuestForm
        guestListId={guestListId}
        onSuccess={onSuccess}
        open={isOpen}
        onOpenChange={setIsOpen}
        quickAdd={quickAdd}
      />
    </>
  );
}
