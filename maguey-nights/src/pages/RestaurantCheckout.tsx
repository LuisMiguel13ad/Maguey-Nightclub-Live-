import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Minus, Trash2 } from "lucide-react";
import { motion } from "framer-motion";

interface CartItem {
  id: string;
  name: string;
  description: string;
  price: number;
  salePrice?: number;
  quantity: number;
}

const RestaurantCheckout = () => {
  const navigate = useNavigate();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<"pickup" | "delivery">("pickup");
  const [customerInfo, setCustomerInfo] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    specialInstructions: "",
  });

  useEffect(() => {
    window.scrollTo(0, 0);
    // Load cart from sessionStorage
    const savedCart = sessionStorage.getItem("restaurantCart");
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    } else {
      // If no cart, redirect to menu
      navigate("/restaurant/menu");
    }
  }, [navigate]);

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prevCart) => {
      const updatedCart = prevCart.map((item) =>
        item.id === itemId ? { ...item, quantity: item.quantity + delta } : item
      ).filter((item) => item.quantity > 0);
      sessionStorage.setItem("restaurantCart", JSON.stringify(updatedCart));
      return updatedCart;
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart((prevCart) => {
      const updatedCart = prevCart.filter((item) => item.id !== itemId);
      sessionStorage.setItem("restaurantCart", JSON.stringify(updatedCart));
      return updatedCart;
    });
  };

  const getTotalPrice = () => {
    return cart.reduce((total, item) => {
      const itemPrice = item.salePrice || item.price;
      return total + itemPrice * item.quantity;
    }, 0);
  };

  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (cart.length === 0) {
      alert("Your cart is empty!");
      return;
    }

    if (!customerInfo.name || !customerInfo.phone || !customerInfo.email) {
      alert("Please fill in your name, phone, and email.");
      return;
    }

    if (orderType === "delivery" && !customerInfo.address) {
      alert("Please provide a delivery address.");
      return;
    }

    const deliveryFee = orderType === "delivery" ? 5.00 : 0;
    const total = getTotalPrice() + deliveryFee;
    
    // Here you would typically send the order to your backend
    // Clear cart and redirect
    sessionStorage.removeItem("restaurantCart");
    alert("Thank you for your order! We'll contact you shortly to confirm.");
    navigate("/restaurant");
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-black">
        <Navigation />
        <div className="pt-32 pb-20 px-4 text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Your cart is empty</h1>
          <Button onClick={() => navigate("/restaurant/menu")} className="bg-[#8B0000] hover:bg-[#A52A2A] text-white">
            Return to Menu
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <Navigation />
      
      {/* Header */}
      <section className="relative pt-32 pb-8 px-4 bg-black">
        <div className="container mx-auto max-w-4xl text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-4xl md:text-5xl font-black text-white mb-4"
          >
            CHECKOUT
          </motion.h1>
        </div>
      </section>

      {/* Checkout Content */}
      <section className="py-8 px-4 bg-black">
        <div className="container mx-auto max-w-4xl">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Order Summary - Left Side */}
            <div className="lg:col-span-2 space-y-6">
              {/* Order Type Selection */}
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white">Order Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4">
                    <Button
                      onClick={() => setOrderType("pickup")}
                      className={`flex-1 ${
                        orderType === "pickup"
                          ? "bg-[#8B0000] text-white"
                          : "bg-white/10 text-white/70 hover:bg-white/20"
                      }`}
                    >
                      Pickup
                    </Button>
                    <Button
                      onClick={() => setOrderType("delivery")}
                      className={`flex-1 ${
                        orderType === "delivery"
                          ? "bg-[#8B0000] text-white"
                          : "bg-white/10 text-white/70 hover:bg-white/20"
                      }`}
                    >
                      Delivery
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Cart Items */}
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white">Your Order</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {cart.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10"
                      >
                        <div className="flex-1">
                          <h4 className="text-white font-semibold">{item.name}</h4>
                          <p className="text-white/60 text-sm mt-1">
                            ${(item.salePrice || item.price).toFixed(2)} each
                            {item.salePrice && (
                              <span className="text-white/40 line-through ml-2">
                                ${item.price.toFixed(2)}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateQuantity(item.id, -1)}
                            className="w-8 h-8 p-0 text-white hover:bg-white/10"
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          <span className="text-white font-bold w-8 text-center">{item.quantity}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateQuantity(item.id, 1)}
                            className="w-8 h-8 p-0 text-white hover:bg-white/10"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeFromCart(item.id)}
                            className="w-8 h-8 p-0 text-red-400 hover:bg-red-400/20"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Customer Information Form */}
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white">Customer Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmitOrder} className="space-y-4">
                    <Input
                      placeholder="Full Name *"
                      value={customerInfo.name}
                      onChange={(e) =>
                        setCustomerInfo({ ...customerInfo, name: e.target.value })
                      }
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                      required
                    />
                    <Input
                      type="tel"
                      placeholder="Phone Number *"
                      value={customerInfo.phone}
                      onChange={(e) =>
                        setCustomerInfo({ ...customerInfo, phone: e.target.value })
                      }
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                      required
                    />
                    <Input
                      type="email"
                      placeholder="Email *"
                      value={customerInfo.email}
                      onChange={(e) =>
                        setCustomerInfo({ ...customerInfo, email: e.target.value })
                      }
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                      required
                    />
                    {orderType === "delivery" && (
                      <Textarea
                        placeholder="Delivery Address *"
                        value={customerInfo.address}
                        onChange={(e) =>
                          setCustomerInfo({ ...customerInfo, address: e.target.value })
                        }
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/50 min-h-[80px]"
                        required={orderType === "delivery"}
                      />
                    )}
                    <Textarea
                      placeholder="Special Instructions (optional)"
                      value={customerInfo.specialInstructions}
                      onChange={(e) =>
                        setCustomerInfo({ ...customerInfo, specialInstructions: e.target.value })
                      }
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50 min-h-[80px]"
                    />
                    <Button
                      type="submit"
                      className="w-full bg-[#8B0000] hover:bg-[#A52A2A] text-white font-bold py-3"
                    >
                      Place Order
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Order Summary Sidebar */}
            <div className="lg:col-span-1">
              <Card className="bg-white/5 border-white/10 sticky top-24">
                <CardHeader>
                  <CardTitle className="text-white">Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {cart.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-white/70">
                          {item.name} x{item.quantity}
                        </span>
                        <span className="text-white">
                          ${((item.salePrice || item.price) * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="border-t border-white/10 pt-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-white/70">Subtotal</span>
                      <span className="text-white">${getTotalPrice().toFixed(2)}</span>
                    </div>
                    {orderType === "delivery" && (
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-white/70">Delivery Fee</span>
                        <span className="text-white">$5.00</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-4 border-t border-white/10">
                      <span className="text-white text-lg font-bold">Total</span>
                      <span className="text-[#FFD700] text-xl font-black">
                        ${(getTotalPrice() + (orderType === "delivery" ? 5.00 : 0)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default RestaurantCheckout;

