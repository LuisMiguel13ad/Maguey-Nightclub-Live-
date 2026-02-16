/**
 * Guest List Table Component
 * 
 * Reusable table for displaying guest list entries with actions.
 */

import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GuestListEntry } from '@/lib/guest-list-service';
import { CheckCircle2, XCircle, Search, Trash2, Edit } from 'lucide-react';
import { format } from 'date-fns';

interface GuestListTableProps {
  entries: GuestListEntry[];
  onCheckIn?: (entry: GuestListEntry) => void;
  onRemove?: (entry: GuestListEntry) => void;
  onEdit?: (entry: GuestListEntry) => void;
  showCheckInButton?: boolean;
  showActions?: boolean;
}

export function GuestListTable({
  entries,
  onCheckIn,
  onRemove,
  onEdit,
  showCheckInButton = true,
  showActions = true,
}: GuestListTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'checked_in'>('all');
  const [removingEntry, setRemovingEntry] = useState<GuestListEntry | null>(null);

  const filteredEntries = entries.filter((entry) => {
    const matchesSearch =
      entry.guestName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.guestEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.guestPhone?.includes(searchTerm) ||
      entry.notes?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'pending' && entry.status === 'pending') ||
      (statusFilter === 'checked_in' && entry.status === 'checked_in');

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: GuestListEntry['status']) => {
    switch (status) {
      case 'checked_in':
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Checked In
          </Badge>
        );
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      case 'no_show':
        return <Badge variant="secondary">No Show</Badge>;
      case 'cancelled':
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getListTypeBadge = (listType: GuestListEntry['listType']) => {
    const colors = {
      vip: 'bg-purple-500',
      comp: 'bg-blue-500',
      reduced: 'bg-yellow-500',
      standard: 'bg-gray-500',
    };

    return (
      <Badge className={colors[listType] || 'bg-gray-500'}>
        {listType.toUpperCase()}
      </Badge>
    );
  };

  const handleRemove = async () => {
    if (removingEntry && onRemove) {
      await onRemove(removingEntry);
      setRemovingEntry(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search by name, email, phone, or notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="checked_in">Checked In</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Plus Ones</TableHead>
              <TableHead>List Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Added By</TableHead>
              {showActions && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showActions ? 7 : 6} className="text-center text-muted-foreground py-8">
                  No guests found
                </TableCell>
              </TableRow>
            ) : (
              filteredEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">
                    <div>
                      {entry.guestName}
                      {entry.notes && (
                        <div className="text-xs text-muted-foreground mt-1">{entry.notes}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {entry.guestEmail && <div>{entry.guestEmail}</div>}
                      {entry.guestPhone && <div className="text-muted-foreground">{entry.guestPhone}</div>}
                    </div>
                  </TableCell>
                  <TableCell>
                    {entry.status === 'checked_in' && entry.actualPlusOnes !== undefined
                      ? entry.actualPlusOnes
                      : entry.plusOnes}
                  </TableCell>
                  <TableCell>{getListTypeBadge(entry.listType)}</TableCell>
                  <TableCell>
                    {getStatusBadge(entry.status)}
                    {entry.checkedInAt && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {format(new Date(entry.checkedInAt), 'MMM d, h:mm a')}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {entry.addedByName || 'Unknown'}
                  </TableCell>
                  {showActions && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {showCheckInButton && entry.status === 'pending' && onCheckIn && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onCheckIn(entry)}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Check In
                          </Button>
                        )}
                        {onEdit && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onEdit(entry)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                        {onRemove && entry.status !== 'checked_in' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setRemovingEntry(entry)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Remove Confirmation Dialog */}
      <Dialog open={!!removingEntry} onOpenChange={(open) => !open && setRemovingEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Guest</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {removingEntry?.guestName} from the guest list?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemovingEntry(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemove}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
