import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, Users, CreditCard, Mail, Phone, User } from 'lucide-react';
import { events, getEventById, Event } from '@/data/events';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

// Stripe configuration
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_your_key_here');

interface TicketOption {
  id: string;
  name: string;
  price: number;
  description: string;
  includes: string[];
  maxPerOrder: number;
  available: number;
}

interface TableOption {
  id: string;
  name: string;
  price: number;
  capacity: number;
  description: string;
  includes: string[];
  available: number;
}

interface CustomerInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  agreeToTerms: boolean;
  agreeToMarketing: boolean;
}

const Checkout = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [selectedTickets, setSelectedTickets] = useState<{[key: string]: number}>({});
  const [selectedTables, setSelectedTables] = useState<{[key: string]: number}>({});
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    agreeToTerms: false,
    agreeToMarketing: false
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  // Ticket and table options
  const ticketOptions: TicketOption[] = [
    {
      id: 'general-admission',
      name: 'General Admission',
      price: 30,
      description: 'Entry to the event',
      includes: ['Event Access', 'Dance Floor', 'Bar Access'],
      maxPerOrder: 10,
      available: 200
    },
    {
      id: 'vip-ticket',
      name: 'VIP Ticket',
      price: 60,
      description: 'Premium experience with perks',
      includes: ['VIP Area Access', 'Complimentary Drink', 'Priority Entry', 'Dance Floor'],
      maxPerOrder: 6,
      available: 50
    },
    {
      id: 'early-bird',
      name: 'Early Bird',
      price: 20,
      description: 'Discounted entry before 10 PM',
      includes: ['Event Access', 'Dance Floor', 'Bar Access'],
      maxPerOrder: 8,
      available: 100
    }
  ];

  const tableOptions: TableOption[] = [
    {
      id: 'standard-table',
      name: 'Standard Table',
      price: 200,
      capacity: 4,
      description: 'Perfect for small groups',
      includes: ['Table Service', 'Bottle Service', 'VIP Area Access'],
      available: 15
    },
    {
      id: 'premium-table',
      name: 'Premium Table',
      price: 400,
      capacity: 6,
      description: 'Luxury experience with premium service',
      includes: ['Premium Table Service', 'Premium Bottle Service', 'VIP Area Access', 'Dedicated Server'],
      available: 8
    },
    {
      id: 'owners-table',
      name: 'Owner\'s Table',
      price: 800,
      capacity: 8,
      description: 'The ultimate VIP experience',
      includes: ['Exclusive Table Service', 'Premium Bottle Service', 'VIP Area Access', 'Dedicated Server', 'Complimentary Appetizers'],
      available: 2
    }
  ];

  useEffect(() => {
    if (eventId) {
      const foundEvent = getEventById(eventId);
      if (foundEvent) {
        setEvent(foundEvent);
      } else {
        navigate('/events');
      }
    }
  }, [eventId, navigate]);

  const calculateSubtotal = () => {
    let total = 0;
    Object.entries(selectedTickets).forEach(([ticketId, quantity]) => {
      const ticket = ticketOptions.find(t => t.id === ticketId);
      if (ticket) total += ticket.price * quantity;
    });
    Object.entries(selectedTables).forEach(([tableId, quantity]) => {
      const table = tableOptions.find(t => t.id === tableId);
      if (table) total += table.price * quantity;
    });
    return total;
  };

  const calculateTax = () => {
    return calculateSubtotal() * 0.08; // 8% tax
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax();
  };

  const handleTicketChange = (ticketId: string, quantity: number) => {
    setSelectedTickets(prev => ({
      ...prev,
      [ticketId]: quantity
    }));
  };

  const handleTableChange = (tableId: string, quantity: number) => {
    setSelectedTables(prev => ({
      ...prev,
      [tableId]: quantity
    }));
  };

  const handleCustomerInfoChange = (field: keyof CustomerInfo, value: string | boolean) => {
    setCustomerInfo(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCheckout = async () => {
    if (!customerInfo.agreeToTerms) {
      alert('Please agree to the terms and conditions');
      return;
    }

    setIsProcessing(true);
    try {
      // Create order
      const order = {
        eventId: eventId,
        event: event,
        tickets: selectedTickets,
        tables: selectedTables,
        customer: customerInfo,
        subtotal: calculateSubtotal(),
        tax: calculateTax(),
        total: calculateTotal(),
        orderId: `MAG-${Date.now()}`,
        timestamp: new Date().toISOString()
      };

      // Send to backend for processing
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(order)
      });

      if (response.ok) {
        const { paymentIntent } = await response.json();
        // Redirect to payment processing
        navigate(`/payment/${paymentIntent.id}`);
      } else {
        throw new Error('Failed to create order');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!event) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-black">
      <Navigation />
      
      <div className="pt-20 pb-12">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Event Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">{event.artist}</h1>
            <div className="flex items-center justify-center space-x-6 text-gray-300">
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5" />
                <span>{event.date}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5" />
                <span>{event.time}</span>
              </div>
              <div className="flex items-center space-x-2">
                <MapPin className="w-5 h-5" />
                <span>{event.venue}</span>
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Checkout Form */}
            <div className="lg:col-span-2 space-y-8">
              {/* Step 1: Ticket Selection */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Card className="bg-gray-900 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center space-x-2">
                      <Users className="w-5 h-5" />
                      <span>Select Tickets</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {ticketOptions.map((ticket) => (
                      <div key={ticket.id} className="flex items-center justify-between p-4 border border-gray-700 rounded-lg">
                        <div className="flex-1">
                          <h3 className="text-white font-semibold">{ticket.name}</h3>
                          <p className="text-gray-400 text-sm mb-2">{ticket.description}</p>
                          <div className="flex flex-wrap gap-1 mb-2">
                            {ticket.includes.map((item, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {item}
                              </Badge>
                            ))}
                          </div>
                          <p className="text-green-400 font-bold">${ticket.price}</p>
                          <p className="text-gray-500 text-xs">{ticket.available} available</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTicketChange(ticket.id, Math.max(0, (selectedTickets[ticket.id] || 0) - 1))}
                            disabled={!selectedTickets[ticket.id]}
                          >
                            -
                          </Button>
                          <span className="text-white w-8 text-center">{selectedTickets[ticket.id] || 0}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTicketChange(ticket.id, Math.min(ticket.maxPerOrder, (selectedTickets[ticket.id] || 0) + 1))}
                            disabled={(selectedTickets[ticket.id] || 0) >= ticket.maxPerOrder}
                          >
                            +
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Step 2: Table Selection */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card className="bg-gray-900 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center space-x-2">
                      <Users className="w-5 h-5" />
                      <span>Reserve Tables (Optional)</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {tableOptions.map((table) => (
                      <div key={table.id} className="flex items-center justify-between p-4 border border-gray-700 rounded-lg">
                        <div className="flex-1">
                          <h3 className="text-white font-semibold">{table.name}</h3>
                          <p className="text-gray-400 text-sm mb-2">{table.description}</p>
                          <p className="text-gray-300 text-sm mb-2">Capacity: {table.capacity} people</p>
                          <div className="flex flex-wrap gap-1 mb-2">
                            {table.includes.map((item, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {item}
                              </Badge>
                            ))}
                          </div>
                          <p className="text-green-400 font-bold">${table.price}</p>
                          <p className="text-gray-500 text-xs">{table.available} available</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTableChange(table.id, Math.max(0, (selectedTables[table.id] || 0) - 1))}
                            disabled={!selectedTables[table.id]}
                          >
                            -
                          </Button>
                          <span className="text-white w-8 text-center">{selectedTables[table.id] || 0}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTableChange(table.id, Math.min(table.available, (selectedTables[table.id] || 0) + 1))}
                            disabled={(selectedTables[table.id] || 0) >= table.available}
                          >
                            +
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Step 3: Customer Information */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="bg-gray-900 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center space-x-2">
                      <User className="w-5 h-5" />
                      <span>Customer Information</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="firstName" className="text-white">First Name</Label>
                        <Input
                          id="firstName"
                          value={customerInfo.firstName}
                          onChange={(e) => handleCustomerInfoChange('firstName', e.target.value)}
                          className="bg-gray-800 border-gray-600 text-white"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="lastName" className="text-white">Last Name</Label>
                        <Input
                          id="lastName"
                          value={customerInfo.lastName}
                          onChange={(e) => handleCustomerInfoChange('lastName', e.target.value)}
                          className="bg-gray-800 border-gray-600 text-white"
                          required
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="email" className="text-white">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={customerInfo.email}
                          onChange={(e) => handleCustomerInfoChange('email', e.target.value)}
                          className="bg-gray-800 border-gray-600 text-white"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="phone" className="text-white">Phone</Label>
                        <Input
                          id="phone"
                          type="tel"
                          value={customerInfo.phone}
                          onChange={(e) => handleCustomerInfoChange('phone', e.target.value)}
                          className="bg-gray-800 border-gray-600 text-white"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="dateOfBirth" className="text-white">Date of Birth</Label>
                      <Input
                        id="dateOfBirth"
                        type="date"
                        value={customerInfo.dateOfBirth}
                        onChange={(e) => handleCustomerInfoChange('dateOfBirth', e.target.value)}
                        className="bg-gray-800 border-gray-600 text-white"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="agreeToTerms"
                          checked={customerInfo.agreeToTerms}
                          onCheckedChange={(checked) => handleCustomerInfoChange('agreeToTerms', checked as boolean)}
                        />
                        <Label htmlFor="agreeToTerms" className="text-white text-sm">
                          I agree to the terms and conditions and age verification (21+)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="agreeToMarketing"
                          checked={customerInfo.agreeToMarketing}
                          onCheckedChange={(checked) => handleCustomerInfoChange('agreeToMarketing', checked as boolean)}
                        />
                        <Label htmlFor="agreeToMarketing" className="text-white text-sm">
                          I would like to receive updates about future events
                        </Label>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="sticky top-24"
              >
                <Card className="bg-gray-900 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white">Order Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Tickets */}
                    {Object.entries(selectedTickets).map(([ticketId, quantity]) => {
                      const ticket = ticketOptions.find(t => t.id === ticketId);
                      if (!ticket || quantity === 0) return null;
                      return (
                        <div key={ticketId} className="flex justify-between text-white">
                          <span>{ticket.name} x{quantity}</span>
                          <span>${ticket.price * quantity}</span>
                        </div>
                      );
                    })}

                    {/* Tables */}
                    {Object.entries(selectedTables).map(([tableId, quantity]) => {
                      const table = tableOptions.find(t => t.id === tableId);
                      if (!table || quantity === 0) return null;
                      return (
                        <div key={tableId} className="flex justify-between text-white">
                          <span>{table.name} x{quantity}</span>
                          <span>${table.price * quantity}</span>
                        </div>
                      );
                    })}

                    <Separator className="bg-gray-700" />

                    <div className="flex justify-between text-white">
                      <span>Subtotal</span>
                      <span>${calculateSubtotal().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-white">
                      <span>Tax (8%)</span>
                      <span>${calculateTax().toFixed(2)}</span>
                    </div>
                    <Separator className="bg-gray-700" />
                    <div className="flex justify-between text-white text-lg font-bold">
                      <span>Total</span>
                      <span>${calculateTotal().toFixed(2)}</span>
                    </div>

                    <Button
                      onClick={handleCheckout}
                      disabled={isProcessing || calculateTotal() === 0 || !customerInfo.agreeToTerms}
                      className="w-full bg-green-600 hover:bg-green-700 text-white py-3"
                    >
                      {isProcessing ? 'Processing...' : 'Proceed to Payment'}
                    </Button>

                    <p className="text-gray-400 text-xs text-center">
                      Secure payment powered by Stripe
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Checkout;
