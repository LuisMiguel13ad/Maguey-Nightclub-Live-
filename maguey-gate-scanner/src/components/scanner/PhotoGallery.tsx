import { useState, useEffect } from 'react';
import { Image as ImageIcon, X, ZoomIn, Download, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getTicketPhotos, deletePhoto, type PhotoMetadata } from '@/lib/photo-capture-service';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface PhotoGalleryProps {
  ticketId: string;
  open: boolean;
  onClose: () => void;
}

export const PhotoGallery = ({ ticketId, open, onClose }: PhotoGalleryProps) => {
  const { toast } = useToast();
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<any | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (open && ticketId) {
      loadPhotos();
    }
  }, [open, ticketId]);

  const loadPhotos = async () => {
    setLoading(true);
    try {
      const photoList = await getTicketPhotos(ticketId);
      setPhotos(photoList);
    } catch (error: any) {
      console.error('Failed to load photos:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load photos.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (photoId: string) => {
    if (!confirm('Are you sure you want to delete this photo?')) return;

    setDeletingId(photoId);
    try {
      const success = await deletePhoto(photoId);
      if (success) {
        toast({
          title: 'Photo Deleted',
          description: 'Photo has been deleted successfully.',
        });
        loadPhotos();
      } else {
        toast({
          variant: 'destructive',
          title: 'Delete Failed',
          description: 'Failed to delete photo.',
        });
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to delete photo.',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = (photoUrl: string, photoId: string) => {
    const link = document.createElement('a');
    link.href = photoUrl;
    link.download = `ticket-photo-${photoId}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const metadata = selectedPhoto?.photo_metadata as PhotoMetadata | undefined;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Photo Gallery</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No photos found for this ticket.</p>
          </div>
        ) : (
          <>
            {/* Photo Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
              {photos.map((photo) => (
                <Card
                  key={photo.id}
                  className="relative group cursor-pointer hover:border-primary transition-colors"
                  onClick={() => setSelectedPhoto(photo)}
                >
                  <CardContent className="p-0">
                    <div className="relative aspect-video">
                      <img
                        src={photo.thumbnail_url || photo.photo_url}
                        alt="Ticket photo"
                        className="w-full h-full object-cover rounded-t-lg"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    <div className="p-2">
                      <p className="text-xs text-muted-foreground">
                        {photo.captured_at
                          ? format(new Date(photo.captured_at), 'MMM d, yyyy HH:mm')
                          : 'Unknown date'}
                      </p>
                    </div>
                  </CardContent>
                  {deletingId === photo.id && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                      <Loader2 className="h-6 w-6 animate-spin text-white" />
                    </div>
                  )}
                </Card>
              ))}
            </div>

            {/* Selected Photo Modal */}
            {selectedPhoto && (
              <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
                <DialogContent className="sm:max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>Photo Details</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="relative bg-black rounded-lg overflow-hidden">
                      <img
                        src={selectedPhoto.photo_url}
                        alt="Full size photo"
                        className="w-full h-auto max-h-[60vh] object-contain mx-auto"
                      />
                    </div>

                    {/* Photo Metadata */}
                    {metadata && (
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Dimensions</p>
                          <p className="font-medium">
                            {metadata.width} × {metadata.height}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">File Size</p>
                          <p className="font-medium">
                            {(metadata.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Captured At</p>
                          <p className="font-medium">
                            {selectedPhoto.captured_at
                              ? format(new Date(selectedPhoto.captured_at), 'MMM d, yyyy HH:mm:ss')
                              : 'Unknown'}
                          </p>
                        </div>
                        {metadata.blur_score !== undefined && (
                          <div>
                            <p className="text-muted-foreground">Blur Score</p>
                            <p className="font-medium">
                              {(metadata.blur_score * 100).toFixed(1)}%
                              {metadata.blur_score > 0.5 && (
                                <Badge variant="destructive" className="ml-2 text-xs">
                                  Blurry
                                </Badge>
                              )}
                            </p>
                          </div>
                        )}
                        {metadata.location && (
                          <div className="col-span-2">
                            <p className="text-muted-foreground">Location</p>
                            <p className="font-medium">
                              {metadata.location.latitude?.toFixed(6)}, {metadata.location.longitude?.toFixed(6)}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => handleDownload(selectedPhoto.photo_url, selectedPhoto.id)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          handleDelete(selectedPhoto.id);
                          setSelectedPhoto(null);
                        }}
                        disabled={deletingId === selectedPhoto.id}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

