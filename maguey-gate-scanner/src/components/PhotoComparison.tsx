import { useState } from 'react';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { comparePhotos } from '@/lib/photo-capture-service';
import { useToast } from '@/hooks/use-toast';

interface PhotoComparisonProps {
  open: boolean;
  onClose: () => void;
  photo1Url: string;
  photo2Url: string;
  photo1Id?: string;
  photo2Id?: string;
}

export const PhotoComparison = ({
  open,
  onClose,
  photo1Url,
  photo2Url,
  photo1Id,
  photo2Id,
}: PhotoComparisonProps) => {
  const { toast } = useToast();
  const [similarity, setSimilarity] = useState<number | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  const handleCompare = async () => {
    setIsComparing(true);
    try {
      const score = await comparePhotos(photo1Url, photo2Url);
      setSimilarity(score);
    } catch (error: any) {
      console.error('Photo comparison error:', error);
      toast({
        variant: 'destructive',
        title: 'Comparison Failed',
        description: error.message || 'Failed to compare photos.',
      });
    } finally {
      setIsComparing(false);
    }
  };

  const getSimilarityColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getSimilarityLabel = (score: number) => {
    if (score >= 0.8) return 'Very Similar';
    if (score >= 0.6) return 'Somewhat Similar';
    return 'Different';
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Compare Photos</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Photo Comparison View */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-center">Photo 1</p>
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                <img
                  src={photo1Url}
                  alt="Photo 1"
                  className="w-full h-full object-contain"
                />
              </div>
              {photo1Id && (
                <p className="text-xs text-muted-foreground text-center">ID: {photo1Id}</p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-center">Photo 2</p>
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                <img
                  src={photo2Url}
                  alt="Photo 2"
                  className="w-full h-full object-contain"
                />
              </div>
              {photo2Id && (
                <p className="text-xs text-muted-foreground text-center">ID: {photo2Id}</p>
              )}
            </div>
          </div>

          {/* Comparison Controls */}
          <div className="flex items-center justify-center">
            <Button
              onClick={handleCompare}
              disabled={isComparing}
              className="bg-gradient-purple hover:shadow-glow-purple"
            >
              {isComparing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Comparing...
                </>
              ) : (
                'Compare Photos'
              )}
            </Button>
          </div>

          {/* Similarity Result */}
          {similarity !== null && (
            <Alert
              className={
                similarity >= 0.8
                  ? 'border-yellow-500 bg-yellow-500/10'
                  : similarity >= 0.6
                  ? 'border-yellow-500 bg-yellow-500/10'
                  : 'border-green-500 bg-green-500/10'
              }
            >
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Similarity Score:</span>
                    <span className={`text-lg font-bold ${getSimilarityColor(similarity)}`}>
                      {(similarity * 100).toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-sm">
                    <strong>Result:</strong> {getSimilarityLabel(similarity)}
                  </p>
                  {similarity >= 0.8 && (
                    <p className="text-sm text-yellow-600">
                      ⚠️ These photos appear very similar. This may indicate a duplicate entry attempt.
                    </p>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Note */}
          <p className="text-xs text-muted-foreground text-center">
            Note: This is a basic comparison. For production use, integrate with a face recognition service
            (e.g., AWS Rekognition, Google Vision API) for accurate duplicate detection.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

