import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CreditCard, CheckCircle, XCircle, Loader2, Mail, Download } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_your_key_here');

interface Order {
  orderId: string;
  event: any;
  tickets: {[key: string]: number};
  tables: {[key: string]: number};
  customer: any;
  subtotal: number;
  tax: number;
  total: number;
  timestamp: string;
}

const PaymentForm = () => {
  const { paymentIntentId } = useParams();
  const navigate = useNavigate();
  const stripe = useStripe();
  const elements = useElements();
  
  const [order, setOrder] = useState<Order | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [errorMessage, setErrorMessage] = useState('');
  const [ticketUrl, setTicketUrl] = useState('');

  useEffect(() => {
    // Fetch order details
    const fetchOrder = async () => {
      try {
        const response = await fetch(`/api/orders/${paymentIntentId}`);
        if (response.ok) {
          const orderData = await response.json();
          setOrder(orderData);
        } else {
          throw new Error('Order not found');
        }
      } catch (error) {
        console.error('Error fetching order:', error);
        setErrorMessage('Order not found');
        setPaymentStatus('error');
      }
    };

    fetchOrder();
  }, [paymentIntentId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage('');

    try {
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error('Card element not found');
      }

      // Confirm payment with Stripe
      const { error, paymentIntent } = await stripe.confirmCardPayment(paymentIntentId!, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: `${order?.customer.firstName} ${order?.customer.lastName}`,
            email: order?.customer.email,
            phone: order?.customer.phone,
          },
        },
      });

      if (error) {
        setErrorMessage(error.message || 'Payment failed');
        setPaymentStatus('error');
      } else if (paymentIntent.status === 'succeeded') {
        setPaymentStatus('success');
        
        // Generate tickets and send confirmation email
        const response = await fetch('/api/complete-order', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            orderId: order?.orderId,
            paymentIntentId: paymentIntent.id,
            status: 'completed'
          })
        });

        if (response.ok) {
          const { ticketUrl } = await response.json();
          setTicketUrl(ticketUrl);
        }
      }
    } catch (error) {
      console.error('Payment error:', error);
      setErrorMessage('An unexpected error occurred');
      setPaymentStatus('error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadTicket = () => {
    if (ticketUrl) {
      window.open(ticketUrl, '_blank');
    }
  };

  const handleSendEmail = async () => {
    try {
      await fetch('/api/send-ticket-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: order?.orderId,
          email: order?.customer.email
        })
      });
      alert('Ticket sent to your email!');
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Failed to send email. Please try again.');
    }
  };

  if (paymentStatus === 'success') {
    return (
      <div className="min-h-screen bg-black">
        <Navigation />
        <div className="pt-20 pb-12">
          <div className="container mx-auto px-4 max-w-2xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-6" />
              <h1 className="text-4xl font-bold text-white mb-4">Payment Successful!</h1>
              <p className="text-gray-300 mb-8">
                Your tickets have been confirmed and sent to your email.
              </p>

              <Card className="bg-gray-900 border-gray-700 mb-8">
                <CardHeader>
                  <CardTitle className="text-white">Order Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between text-white">
                    <span>Order ID:</span>
                    <span className="font-mono">{order?.orderId}</span>
                  </div>
                  <div className="flex justify-between text-white">
                    <span>Event:</span>
                    <span>{order?.event.artist}</span>
                  </div>
                  <div className="flex justify-between text-white">
                    <span>Date:</span>
                    <span>{order?.event.date}</span>
                  </div>
                  <div className="flex justify-between text-white">
                    <span>Total:</span>
                    <span className="text-green-400 font-bold">${order?.total.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Button
                  onClick={handleDownloadTicket}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-3"
                >
                  <Download className="w-5 h-5 mr-2" />
                  Download Tickets
                </Button>
                <Button
                  onClick={handleSendEmail}
                  variant="outline"
                  className="w-full border-gray-600 text-white hover:bg-gray-800"
                >
                  <Mail className="w-5 h-5 mr-2" />
                  Send to Email Again
                </Button>
                <Button
                  onClick={() => navigate('/events')}
                  variant="outline"
                  className="w-full border-gray-600 text-white hover:bg-gray-800"
                >
                  Browse More Events
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (paymentStatus === 'error') {
    return (
      <div className="min-h-screen bg-black">
        <Navigation />
        <div className="pt-20 pb-12">
          <div className="container mx-auto px-4 max-w-2xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <XCircle className="w-20 h-20 text-red-500 mx-auto mb-6" />
              <h1 className="text-4xl font-bold text-white mb-4">Payment Failed</h1>
              <p className="text-gray-300 mb-8">{errorMessage}</p>
              
              <div className="space-y-4">
                <Button
                  onClick={() => navigate(-1)}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-3"
                >
                  Try Again
                </Button>
                <Button
                  onClick={() => navigate('/events')}
                  variant="outline"
                  className="w-full border-gray-600 text-white hover:bg-gray-800"
                >
                  Browse Events
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <Navigation />
      <div className="pt-20 pb-12">
        <div className="container mx-auto px-4 max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-white mb-4">Complete Payment</h1>
              <p className="text-gray-300">Secure payment powered by Stripe</p>
            </div>

            {order && (
              <Card className="bg-gray-900 border-gray-700 mb-8">
                <CardHeader>
                  <CardTitle className="text-white">Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between text-white">
                    <span>Event:</span>
                    <span>{order.event.artist}</span>
                  </div>
                  <div className="flex justify-between text-white">
                    <span>Date:</span>
                    <span>{order.event.date}</span>
                  </div>
                  <div className="flex justify-between text-white">
                    <span>Total:</span>
                    <span className="text-green-400 font-bold">${order.total.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="bg-gray-900 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center space-x-2">
                  <CreditCard className="w-5 h-5" />
                  <span>Payment Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="text-white text-sm font-medium mb-2 block">
                      Card Details
                    </label>
                    <div className="p-4 border border-gray-600 rounded-lg bg-gray-800">
                      <CardElement
                        options={{
                          style: {
                            base: {
                              fontSize: '16px',
                              color: '#ffffff',
                              '::placeholder': {
                                color: '#9ca3af',
                              },
                            },
                            invalid: {
                              color: '#ef4444',
                            },
                          },
                        }}
                      />
                    </div>
                  </div>

                  {errorMessage && (
                    <Alert className="border-red-500 bg-red-900/20">
                      <XCircle className="h-4 w-4" />
                      <AlertDescription className="text-red-300">
                        {errorMessage}
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button
                    type="submit"
                    disabled={!stripe || isProcessing}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Processing Payment...
                      </>
                    ) : (
                      `Pay $${order?.total.toFixed(2) || '0.00'}`
                    )}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <p className="text-gray-400 text-sm">
                    Your payment information is secure and encrypted
                  </p>
                  <div className="flex items-center justify-center space-x-4 mt-2">
                    <img src="/stripe-logo.png" alt="Stripe" className="h-6" />
                    <span className="text-gray-400 text-xs">Powered by Stripe</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

const Payment = () => {
  return (
    <Elements stripe={stripePromise}>
      <PaymentForm />
    </Elements>
  );
};

export default Payment;
