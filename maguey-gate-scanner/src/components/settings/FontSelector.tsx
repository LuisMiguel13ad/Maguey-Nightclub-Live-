import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface FontSelectorProps {
  label: string;
  value: string;
  onChange: (font: string) => void;
  description?: string;
}

const FONTS = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Open Sans', label: 'Open Sans' },
  { value: 'Lato', label: 'Lato' },
  { value: 'Montserrat', label: 'Montserrat' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Raleway', label: 'Raleway' },
  { value: 'Nunito', label: 'Nunito' },
  { value: 'Playfair Display', label: 'Playfair Display' },
  { value: 'Merriweather', label: 'Merriweather' },
  { value: 'Source Sans Pro', label: 'Source Sans Pro' },
  { value: 'Ubuntu', label: 'Ubuntu' },
];

export const FontSelector = ({ label, value, onChange, description }: FontSelectorProps) => {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select font" />
        </SelectTrigger>
        <SelectContent>
          {FONTS.map((font) => (
            <SelectItem key={font.value} value={font.value}>
              <span style={{ fontFamily: font.value }}>{font.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value && (
        <div className="p-3 border rounded-md bg-muted/50">
          <p className="text-sm text-muted-foreground mb-1">Preview:</p>
          <p style={{ fontFamily: value }} className="text-lg">
            The quick brown fox jumps over the lazy dog
          </p>
        </div>
      )}
    </div>
  );
};

