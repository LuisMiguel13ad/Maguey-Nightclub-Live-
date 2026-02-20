/**
 * VIP Table Reservation Form Component
 * Collects customer info, guest count, and bottle choice
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  User,
  Mail,
  Phone,
  Users,
  Wine,
  MessageSquare,
  AlertCircle,
  Info,
  Minus,
  Plus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { 
  type VipTableWithAvailability,
  BOTTLE_CHOICES,
  getBottleChoicesByCategory,
} from '@/lib/vip-tables-service';

// Form validation schema
const reservationSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string()
    .min(10, 'Phone number must be at least 10 digits')
    .regex(/^[\d\s\-()+]+$/, 'Please enter a valid phone number'),
  guestCount: z.number()
    .min(1, 'At least 1 guest is required'),
  bottleChoice: z.string().optional(),
  specialRequests: z.string().optional(),
  agreeToPolicy: z.boolean().refine(val => val === true, {
    message: 'You must agree to the no-refund policy',
  }),
});

export type ReservationFormData = z.infer<typeof reservationSchema>;

interface VipReservationFormProps {
  table: VipTableWithAvailability;
  eventName: string;
  eventDate: string;
  onSubmit: (data: ReservationFormData) => void;
  isSubmitting?: boolean;
  defaultValues?: Partial<ReservationFormData>;
}

export const VipReservationForm = ({
  table,
  eventName,
  eventDate,
  onSubmit,
  isSubmitting = false,
  defaultValues,
}: VipReservationFormProps) => {
  const [guestCount, setGuestCount] = useState(defaultValues?.guestCount || Math.min(4, table.guest_capacity));
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<ReservationFormData>({
    resolver: zodResolver(reservationSchema),
    defaultValues: {
      firstName: defaultValues?.firstName || '',
      lastName: defaultValues?.lastName || '',
      email: defaultValues?.email || '',
      phone: defaultValues?.phone || '',
      guestCount: guestCount,
      bottleChoice: defaultValues?.bottleChoice || '',
      specialRequests: defaultValues?.specialRequests || '',
      agreeToPolicy: false,
    },
  });

  const agreeToPolicy = watch('agreeToPolicy');
  const bottleChoicesByCategory = getBottleChoicesByCategory();

  // Update guest count
  const updateGuestCount = (delta: number) => {
    const newCount = Math.max(1, Math.min(table.guest_capacity, guestCount + delta));
    setGuestCount(newCount);
    setValue('guestCount', newCount);
  };

  // Format phone number as user types
  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`;
    return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`;
  };

  const handleFormSubmit = (data: ReservationFormData) => {
    onSubmit({
      ...data,
      guestCount,
    });
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Selected Table Summary */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            <span>Your Selection</span>
            <Badge className="text-lg px-3 py-1">${table.price}</Badge>
          </CardTitle>
          <CardDescription>
            {eventName} • {new Date(eventDate).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-white">{table.table_name}</p>
              <p className="text-sm text-muted-foreground">{table.bottle_service_description}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Max Guests</p>
              <p className="font-semibold">{table.guest_capacity}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Guest Count Selector */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Number of Guests
          </CardTitle>
          <CardDescription>
            How many people will be at your table? (Including yourself)
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-center gap-4">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => updateGuestCount(-1)}
              disabled={guestCount <= 1}
              className="w-12 h-12 rounded-full"
            >
              <Minus className="w-5 h-5" />
            </Button>
            
            <div className="text-center min-w-[100px]">
              <span className="text-4xl font-bold text-white">{guestCount}</span>
              <p className="text-sm text-muted-foreground mt-1">
                guest{guestCount !== 1 ? 's' : ''}
              </p>
            </div>
            
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => updateGuestCount(1)}
              disabled={guestCount >= table.guest_capacity}
              className="w-12 h-12 rounded-full"
            >
              <Plus className="w-5 h-5" />
            </Button>
          </div>
          
          {guestCount === table.guest_capacity && (
            <p className="text-center text-sm text-amber-400 mt-3">
              Maximum capacity for this table
            </p>
          )}

          <p className="text-center text-sm text-muted-foreground mt-3">
            Each guest will receive a separate QR code for entry
          </p>
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Contact Information
          </CardTitle>
          <CardDescription>
            We'll send the reservation confirmation and QR codes to this email
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                placeholder="John"
                {...register('firstName')}
                disabled={isSubmitting}
                className={cn(errors.firstName && 'border-red-500')}
              />
              {errors.firstName && (
                <p className="text-sm text-red-500">{errors.firstName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                placeholder="Doe"
                {...register('lastName')}
                disabled={isSubmitting}
                className={cn(errors.lastName && 'border-red-500')}
              />
              {errors.lastName && (
                <p className="text-sm text-red-500">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                {...register('email')}
                disabled={isSubmitting}
                className={cn('pl-10', errors.email && 'border-red-500')}
              />
            </div>
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number *</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 123-4567"
                {...register('phone')}
                onChange={(e) => {
                  const formatted = formatPhoneNumber(e.target.value);
                  setValue('phone', formatted);
                }}
                disabled={isSubmitting}
                className={cn('pl-10', errors.phone && 'border-red-500')}
              />
            </div>
            {errors.phone && (
              <p className="text-sm text-red-500">{errors.phone.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              We may contact you with important updates about your reservation
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Bottle Selection (for Premium tables) */}
      {table.tier === 'premium' && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Wine className="w-5 h-5 text-primary" />
              Choose Your Bottle
            </CardTitle>
            <CardDescription>
              Premium tables include your choice of bottle + complimentary champagne
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Select
              onValueChange={(value) => setValue('bottleChoice', value)}
              disabled={isSubmitting}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select your preferred bottle" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(bottleChoicesByCategory).map(([category, bottles]) => (
                  <div key={category}>
                    <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                      {category}
                    </div>
                    {bottles.map((bottle) => (
                      <SelectItem key={bottle.id} value={bottle.id}>
                        {bottle.name}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Special Requests */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Special Requests
            <Badge variant="outline" className="ml-2">Optional</Badge>
          </CardTitle>
          <CardDescription>
            Birthday celebration? Special occasion? Let us know!
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <Textarea
            placeholder="E.g., Birthday celebration, need extra ice bucket, prefer corner seating..."
            {...register('specialRequests')}
            disabled={isSubmitting}
            rows={3}
          />
        </CardContent>
      </Card>

      {/* No Refund Policy Agreement */}
      <Alert className="border-red-500/50 bg-red-500/10">
        <AlertCircle className="h-4 w-4 text-red-500" />
        <AlertDescription className="text-red-200">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="font-semibold mb-1">No Refund Policy</p>
              <p className="text-sm">
                All VIP table reservations are final and non-refundable. 
                By proceeding with this reservation, you acknowledge and agree that 
                no refunds will be issued under any circumstances.
              </p>
            </div>
          </div>
        </AlertDescription>
      </Alert>

      <div className="flex items-start space-x-3">
        <Checkbox
          id="agreeToPolicy"
          checked={agreeToPolicy}
          onCheckedChange={(checked) => setValue('agreeToPolicy', checked === true)}
          disabled={isSubmitting}
          className={cn(errors.agreeToPolicy && 'border-red-500')}
        />
        <div className="space-y-1 leading-none">
          <Label
            htmlFor="agreeToPolicy"
            className={cn(
              'text-sm cursor-pointer',
              errors.agreeToPolicy && 'text-red-500'
            )}
          >
            I understand and agree to the no-refund policy *
          </Label>
          {errors.agreeToPolicy && (
            <p className="text-sm text-red-500">{errors.agreeToPolicy.message}</p>
          )}
        </div>
      </div>

      {/* Order Summary */}
      <Card className="border-primary/30 bg-black/40">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-muted-foreground">Table Reservation</span>
            <span className="font-semibold">${table.price.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-muted-foreground">Number of Guests</span>
            <span>{guestCount}</span>
          </div>
          <div className="border-t border-border/50 pt-4">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold">Total</span>
              <span className="text-2xl font-bold text-primary">${table.price.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submit Button */}
      <Button
        type="submit"
        size="lg"
        className="w-full bg-primary hover:bg-primary/90 text-lg py-6"
        disabled={isSubmitting || !agreeToPolicy}
      >
        {isSubmitting ? (
          <>Processing...</>
        ) : (
          <>Proceed to Payment - ${table.price.toFixed(2)}</>
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <Info className="w-4 h-4 inline mr-1" />
        You'll receive {guestCount} QR code{guestCount !== 1 ? 's' : ''} for entry after payment
      </p>
    </form>
  );
};

export default VipReservationForm;
