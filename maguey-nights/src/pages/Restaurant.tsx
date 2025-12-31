import { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Plus, Minus, ShoppingCart, Clock, MapPin, Phone, Mail, UtensilsCrossed, ChefHat, Users } from "lucide-react";
import { motion } from "framer-motion";

// Import images for gallery
import venuePatio from "@/Pictures/venue-patio.jpg";
import venueMainstage from "@/Pictures/venue-mainstage.jpg";
import eventReggaeton from "@/Pictures/event-reggaeton.jpg";
import social1 from "@/Pictures/social-1.jpg";
import social2 from "@/Pictures/social-2.jpg";
import social3 from "@/Pictures/social-3.jpg";

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  salePrice?: number; // For seafood items with Sunday special pricing
}

interface CartItem extends MenuItem {
  quantity: number;
}

const menuItems: MenuItem[] = [
  // TACOS
  { id: "t1", name: "Tacos Al Pastor", description: "Split grilled pork marinated in red sauce", price: 1.00, category: "tacos" },
  { id: "t2", name: "Tacos De Asada", description: "Sliced grilled steak", price: 1.00, category: "tacos" },
  { id: "t3", name: "Tacos De Carnitas", description: "Seasoned fried pork", price: 1.00, category: "tacos" },
  { id: "t4", name: "Tacos Campechanos", description: "Mixed pastor and grilled steak (asada)", price: 1.00, category: "tacos" },
  { id: "t5", name: "Tacos De Lengua", description: "Beef tongue tacos - a classic Mexican recipe", price: 2.50, category: "tacos" },
  { id: "t6", name: "Tacos De Chorizo", description: "Pork sausage seasoned with traditional spices", price: 2.50, category: "tacos" },
  { id: "t7", name: "Pollo A La Plancha", description: "Seasoned and grilled chicken tacos", price: 2.50, category: "tacos" },
  { id: "t8", name: "Tacos Marisqueros (3)", description: "Fish or shrimp tacos", price: 11.99, salePrice: 17.99, category: "tacos" },
  
  // APPETIZERS
  { id: "a1", name: "Tres Carnes Nachos", description: "Best Nachos In Town! Chorizo, beef & chicken", price: 14.00, category: "appetizers" },
  
  // PLATTERS (All served with rice and beans)
  { id: "p1", name: "El Maguey Carne Asada", description: "Grilled beef steak - served with rice and beans", price: 14.00, category: "platters" },
  { id: "p2", name: "Bistec A La Mexicana", description: "Mexican style beef steak - served with rice and beans", price: 14.00, category: "platters" },
  { id: "p3", name: "Pechuga A La Plancha", description: "Grilled chicken breast - served with rice and beans", price: 13.00, category: "platters" },
  { id: "p4", name: "Auténtico Mole Poblano", description: "Our authentic mole poblano sauce with chicken - served with rice and beans", price: 13.00, category: "platters" },
  { id: "p5", name: "El Maguey Chilaquiles Verdes O Rojos", description: "Green or red chilaquiles con pollo y huevo (grilled chicken and eggs) - served with rice and beans", price: 13.00, category: "platters" },
  { id: "p6", name: "Carne Asada", description: "Grilled beef - served with rice and beans", price: 14.00, category: "platters" },
  
  // FAJITAS
  { id: "f1", name: "Fajitas De Camarón", description: "Shrimp fajitas", price: 15.00, category: "fajitas" },
  { id: "f2", name: "Fajitas De Pollo", description: "Chicken fajitas", price: 12.00, category: "fajitas" },
  { id: "f3", name: "Fajitas De Res", description: "Beef fajitas", price: 13.00, category: "fajitas" },
  { id: "f4", name: "Fajitas Mixtas", description: "Pollo, Res Y Camarón - Chicken, beef and shrimp", price: 16.99, category: "fajitas" },
  
  // ANTOJITOS
  { id: "an1", name: "Quesadilla Casera", description: "Steak, chicken or chorizo - served with rice and beans", price: 11.00, category: "antojitos" },
  { id: "an2", name: "Cemita Cholula", description: "Steak, chicken or chorizo", price: 10.00, category: "antojitos" },
  { id: "an3", name: "Torta", description: "Steak, chicken or chorizo", price: 9.00, category: "antojitos" },
  { id: "an4", name: "Torta Cubana", description: "Cuban style torta", price: 12.00, category: "antojitos" },
  { id: "an5", name: "El Burrito Diablito", description: "Our signature burrito", price: 10.00, category: "antojitos" },
  { id: "an6", name: "Pancita De Res (Menudo)", description: "Beef stomach soup", price: 12.00, category: "antojitos" },
  { id: "an7", name: "Cazuela El Maguey", description: "House specialties mix", price: 35.00, category: "antojitos" },
  
  // DOMINGOS MARISQUEROS (Seafood Sundays)
  { id: "s1", name: "Sea Fries", description: "Crispy seafood fries", price: 4.99, category: "seafood" },
  { id: "s2", name: "Aguachile", description: "House specialty shrimps", price: 16.99, salePrice: 22.99, category: "seafood" },
  { id: "s3", name: "Cóctel De Camarón", description: "Shrimp cocktail", price: 12.99, salePrice: 18.99, category: "seafood" },
  { id: "s4", name: "Caldo De Camarón", description: "Shrimp and vegetables soup", price: 12.99, salePrice: 18.99, category: "seafood" },
  { id: "s5", name: "Camarones A La Mexicana", description: "Mexican style shrimps", price: 13.99, salePrice: 21.99, category: "seafood" },
  { id: "s6", name: "Camarones Enchipotlados", description: "Shrimps seasoned with chipotle sauce", price: 13.99, salePrice: 21.99, category: "seafood" },
  { id: "s7", name: "El Plebe", description: "A La Diabla (very spicy) or chipotle seasoned shrimps", price: 18.99, salePrice: 22.99, category: "seafood" },
  { id: "s8", name: "La Mamalona", description: "Un six bien preparado con Pepino, Jicama, Piña, Tajín y 16 Camarones Jumbo", price: 38.99, salePrice: 58.99, category: "seafood" },
  { id: "s9", name: "Caldo Siete Mares", description: "Seafood mix soup", price: 13.99, salePrice: 21.99, category: "seafood" },
  
  // KID'S MENU
  { id: "k1", name: "Kid's Hot Dogs Con Papas", description: "2 hot dogs with french fries", price: 5.00, category: "kids" },
  { id: "k2", name: "Kid's Chicken Quesadilla", description: "With french fries and rice", price: 5.00, category: "kids" },
  { id: "k3", name: "Kid's Cheeseburger Con Papas", description: "With french fries", price: 5.00, category: "kids" },
  
  // BEBIDAS (Drinks)
  { id: "d1", name: "Pina Colada", description: "Must be 21+ (Please show ID)", price: 8.00, category: "drinks" },
  { id: "d2", name: "Margarita", description: "Must be 21+ (Please show ID)", price: 8.00, category: "drinks" },
  { id: "d3", name: "El Jarrito Diablito", description: "Must be 21+ (Please show ID)", price: 10.00, category: "drinks" },
];

const Restaurant = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [orderType, setOrderType] = useState<"pickup" | "delivery">("pickup");
  const [activeCategory, setActiveCategory] = useState("tacos");
  const [customerInfo, setCustomerInfo] = useState({
    name: "",
    phone: "",
    email: "",
    specialInstructions: "",
  });

  // Gallery images
  const galleryImages = [
    { src: venuePatio, title: "Outdoor Patio Dining" },
    { src: venueMainstage, title: "Restaurant Interior" },
    { src: eventReggaeton, title: "Vibrant Atmosphere" },
    { src: social1, title: "Fresh Ingredients" },
    { src: social2, title: "Authentic Cuisine" },
    { src: social3, title: "Family Dining" },
  ];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const addToCart = (item: MenuItem) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((cartItem) => cartItem.id === item.id);
      if (existingItem) {
        return prevCart.map((cartItem) =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      }
      return [...prevCart, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart((prevCart) => {
      const item = prevCart.find((cartItem) => cartItem.id === itemId);
      if (item && item.quantity > 1) {
        return prevCart.map((cartItem) =>
          cartItem.id === itemId
            ? { ...cartItem, quantity: cartItem.quantity - 1 }
            : cartItem
        );
      }
      return prevCart.filter((cartItem) => cartItem.id !== itemId);
    });
  };

  const getTotalPrice = () => {
    return cart.reduce((total, item) => {
      const itemPrice = item.salePrice || item.price;
      return total + itemPrice * item.quantity;
    }, 0);
  };

  const getTotalItems = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();
    alert("Thank you for your order! We'll contact you shortly to confirm.");
    setCart([]);
    setCustomerInfo({ name: "", phone: "", email: "", specialInstructions: "" });
    setIsCartOpen(false);
  };

  const menuCategories = [
    { id: "tacos", name: "🌮 TACOS" },
    { id: "appetizers", name: "🧀 APPETIZERS (Aperitivos)" },
    { id: "platters", name: "🍽️ PLATTERS (Platillos)" },
    { id: "fajitas", name: "🌶️ FAJITAS" },
    { id: "antojitos", name: "🫔 ANTOJITOS (Traditional Mexican)" },
    { id: "seafood", name: "🦐 DOMINGOS MARISQUEROS (Seafood Sundays)" },
    { id: "kids", name: "👶 KID'S MENU" },
    { id: "drinks", name: "🍹 BEBIDAS (Drinks)" },
  ];

  const getItemsByCategory = (category: string) => {
    return menuItems.filter((item) => item.category === category);
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Navigation */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <Navigation />
      </div>

      {/* Hero Section - Clean Professional Design */}
      <section className="relative pt-32 pb-16 px-4 bg-black">
        <div className="container mx-auto max-w-6xl">
          <div className="relative">
            {/* Background image with overlay */}
            <div 
              className="absolute inset-0 bg-cover bg-center opacity-20"
              style={{ backgroundImage: `url(${venuePatio})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-black" />
            
            <div className="relative z-10 text-center py-16">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="mb-6"
              >
                <div className="flex items-center justify-center gap-8 mb-6">
                  <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white tracking-tight">
                    RESTAURANT
                  </h1>
                  <span className="text-[#FFD700] text-2xl md:text-4xl">•</span>
                  <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white tracking-tight">
                    NIGHTCLUB
                  </h1>
                </div>
                <p className="text-[#FFD700] text-xl md:text-2xl font-light italic mb-4" style={{ fontFamily: 'serif' }}>
                  Taste of Mexico
                </p>
                <h2 className="text-3xl md:text-5xl lg:text-6xl font-black text-white mb-4 tracking-tight">
                  BEST MEXICAN FOOD
                </h2>
                <p className="text-white/90 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
                  Discover the authentic flavors of Mexico at Maguey Delaware, where every dish is a culinary masterpiece. 
                  From sizzling fajitas to mouthwatering tacos, our menu celebrates the vibrant traditions of Mexican cuisine.
                </p>
              </motion.div>
            </div>
          </div>
          
          {/* Decorative Greek Key Pattern Divider */}
          <div className="relative mt-8 flex justify-center">
            <div className="w-full max-w-4xl h-8 bg-gradient-to-r from-transparent via-[#FFD700] to-transparent opacity-30"
                 style={{
                   backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 20px, #FFD700 20px, #FFD700 40px)',
                   clipPath: 'polygon(0 0, 100% 0, 95% 100%, 5% 100%)'
                 }}
            />
          </div>
        </div>
      </section>

      {/* Service Categories Section */}
      <section className="py-16 px-4 bg-black/50">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-center group"
            >
              <div className="bg-[#8B0000]/20 p-6 rounded-lg border border-[#FFD700]/20 hover:border-[#FFD700]/40 transition-all duration-300">
                <UtensilsCrossed className="w-12 h-12 text-[#FFD700] mx-auto mb-4" />
                <h3 className="text-white font-bold text-lg mb-2">RESTAURANT</h3>
                <p className="text-white/70 text-sm">Delicious dishes</p>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-center group"
            >
              <div className="bg-[#8B0000]/20 p-6 rounded-lg border border-[#FFD700]/20 hover:border-[#FFD700]/40 transition-all duration-300">
                <ChefHat className="w-12 h-12 text-[#FFD700] mx-auto mb-4" />
                <h3 className="text-white font-bold text-lg mb-2">AUTHENTIC CUISINE</h3>
                <p className="text-white/70 text-sm">Traditional recipes</p>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-center group"
            >
              <div className="bg-[#8B0000]/20 p-6 rounded-lg border border-[#FFD700]/20 hover:border-[#FFD700]/40 transition-all duration-300">
                <Users className="w-12 h-12 text-[#FFD700] mx-auto mb-4" />
                <h3 className="text-white font-bold text-lg mb-2">FAMILY FRIENDLY</h3>
                <p className="text-white/70 text-sm">Welcoming atmosphere</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Special Event Banner - Cleaner Design */}
      <section className="py-12 px-4 bg-gradient-to-r from-[#8B0000]/90 via-[#8B0000] to-[#8B0000]/90">
        <div className="container mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-black/40 backdrop-blur-sm p-8 rounded-lg border border-[#FFD700]/30"
          >
            <h2 className="text-3xl md:text-4xl font-black text-[#FFD700] mb-3 tracking-wider">
              EL FAMOSO TACO TUESDAY
            </h2>
            <p className="text-white text-xl md:text-2xl font-bold mb-2">
              $1.00 TACOS ALL DAY
            </p>
            <p className="text-white/80 text-sm">
              Live Music After 8pm
            </p>
          </motion.div>
        </div>
      </section>

      {/* Menu Section with Tabs */}
      <section className="py-20 px-4 bg-black">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-wider">
              OUR MENU
            </h2>
            <p className="text-white/70 text-lg">Authentic Mexican Cuisine</p>
          </motion.div>

          <Tabs value={activeCategory} onValueChange={setActiveCategory} className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:grid-cols-8 mb-8 bg-black/50 border border-white/10 h-auto p-2">
              {menuCategories.map((category) => (
                <TabsTrigger
                  key={category.id}
                  value={category.id}
                  className="data-[state=active]:bg-[#8B0000] data-[state=active]:text-white text-white/70 text-xs md:text-sm px-2 py-2"
                >
                  {category.name.split(' ')[0]} {/* Show emoji only */}
                </TabsTrigger>
              ))}
            </TabsList>

            {menuCategories.map((category) => {
              const items = getItemsByCategory(category.id);
              if (items.length === 0) return null;

              return (
                <TabsContent key={category.id} value={category.id} className="mt-8">
                  <div className="mb-6">
                    <h3 className="text-2xl md:text-3xl font-bold text-white mb-4 text-center">
                      {category.name}
                    </h3>
                    {category.id === 'tacos' && (
                      <div className="bg-[#8B0000]/30 border border-[#FFD700]/30 p-4 rounded-lg mb-6 text-center">
                        <p className="text-white font-semibold mb-1">🎉 $1.00 TACO TUESDAY! 🎉</p>
                        <p className="text-white/80 text-sm">All tacos are $2.50 Wednesday thru Monday</p>
                        <p className="text-white/60 text-xs italic mt-1">Todos los tacos cuestan $2.50 de miércoles a lunes</p>
                      </div>
                    )}
                    {category.id === 'platters' && (
                      <p className="text-white/80 text-center mb-6 bg-black/40 p-3 rounded-lg text-sm border border-white/10">
                        All platters served with rice and beans
                      </p>
                    )}
                    {category.id === 'seafood' && (
                      <div className="bg-[#8B0000]/30 border border-[#FFD700]/30 p-4 rounded-lg mb-6 text-center">
                        <p className="text-white font-semibold">🔴 GET ALL SEAFOOD ON SUNDAY ONLY - SPECIAL PRICING! 🔴</p>
                      </div>
                    )}
                    {category.id === 'kids' && (
                      <p className="text-white/80 text-center mb-6 bg-black/40 p-3 rounded-lg text-sm border border-white/10">
                        After 4pm FREE Aguachile - Tuesday and Sunday only
                      </p>
                    )}
                    {category.id === 'drinks' && (
                      <div className="bg-[#8B0000]/30 border border-[#FFD700]/30 p-4 rounded-lg mb-6 text-center">
                        <p className="text-white font-semibold text-sm">🔞 Must be 21 to purchase or drink Alcoholic beverages</p>
                        <p className="text-white/80 text-xs mt-1">PLEASE SHOW ID</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {items.map((item) => (
                      <Card
                        key={item.id}
                        className="bg-white/5 backdrop-blur-sm border border-white/10 hover:border-[#FFD700]/50 transition-all duration-300 hover:shadow-lg hover:shadow-[#FFD700]/20"
                      >
                        <CardContent className="p-6">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1 pr-2">
                              <h4 className="text-lg font-bold text-white mb-2">{item.name}</h4>
                              <p className="text-white/70 text-sm leading-relaxed">{item.description}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              {item.salePrice ? (
                                <div className="text-right">
                                  <p className="text-white/50 text-xs line-through mb-1">
                                    ${item.price.toFixed(2)}
                                  </p>
                                  <p className="text-[#FFD700] font-bold text-lg">
                                    ${item.salePrice.toFixed(2)}
                                  </p>
                                </div>
                              ) : (
                                <p className="text-[#FFD700] font-bold text-lg">
                                  ${item.price.toFixed(2)}
                                </p>
                              )}
                            </div>
                          </div>
                          <Button
                            onClick={() => addToCart(item)}
                            className="w-full bg-[#8B0000] hover:bg-[#A52A2A] text-white font-semibold mt-4"
                            size="sm"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add to Cart
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-4 bg-black/50">
        <div className="container mx-auto max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <p className="text-[#FFD700] text-xl font-light italic mb-4" style={{ fontFamily: 'serif' }}>
                About Our Restaurant
              </p>
              <h2 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight">
                FREQUENTLY ASKED QUESTIONS
              </h2>
              <p className="text-white/80 text-lg leading-relaxed mb-6">
                We're committed to providing you with the best dining experience. Have questions? 
                We're here to help!
              </p>
              <Button className="bg-[#8B0000] hover:bg-[#A52A2A] text-white">
                Learn More
              </Button>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <Accordion type="single" collapsible className="w-full space-y-4">
                <AccordionItem value="item-1" className="border-b border-white/10">
                  <AccordionTrigger className="text-white hover:text-[#FFD700] text-left font-semibold">
                    What makes Maguey Delaware unique?
                  </AccordionTrigger>
                  <AccordionContent className="text-white/80 pt-2">
                    We pride ourselves on authentic Mexican cuisine made with fresh ingredients and traditional recipes passed down through generations. Our vibrant atmosphere and commitment to quality make every visit special.
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="item-2" className="border-b border-white/10">
                  <AccordionTrigger className="text-white hover:text-[#FFD700] text-left font-semibold">
                    What makes your food so good?
                  </AccordionTrigger>
                  <AccordionContent className="text-white/80 pt-2">
                    We use only the freshest ingredients and prepare everything from scratch daily. Our chefs follow traditional Mexican cooking methods and recipes, ensuring authentic flavors in every dish.
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="item-3" className="border-b border-white/10">
                  <AccordionTrigger className="text-white hover:text-[#FFD700] text-left font-semibold">
                    What is your restaurant's atmosphere or vibe?
                  </AccordionTrigger>
                  <AccordionContent className="text-white/80 pt-2">
                    Maguey Delaware offers a warm, family-friendly atmosphere with vibrant Mexican decor. Whether you're dining with family, friends, or on a date, you'll feel welcomed and at home.
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="item-4" className="border-b border-white/10">
                  <AccordionTrigger className="text-white hover:text-[#FFD700] text-left font-semibold">
                    Do you cater to any dietary restrictions?
                  </AccordionTrigger>
                  <AccordionContent className="text-white/80 pt-2">
                    Yes! We offer vegetarian and gluten-free options. Please inform your server about any allergies or dietary restrictions, and we'll be happy to accommodate your needs.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Decorative Divider */}
      <div className="py-8 flex justify-center">
        <div className="w-full max-w-4xl h-8 bg-gradient-to-r from-transparent via-[#FFD700] to-transparent opacity-30"
             style={{
               backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 20px, #FFD700 20px, #FFD700 40px)',
               clipPath: 'polygon(0 0, 100% 0, 95% 100%, 5% 100%)'
             }}
        />
      </div>

      {/* Enhanced Contact Section */}
      <section className="py-20 px-4 bg-black">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              <img
                src={social2}
                alt="Maguey Delaware Staff"
                className="w-full h-[400px] object-cover rounded-lg"
              />
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="bg-[#8B0000] p-8 rounded-lg border border-[#FFD700]/30"
            >
              <h2 className="text-3xl md:text-4xl font-black text-white mb-6 tracking-wider">
                CONTACT US
              </h2>
              
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <MapPin className="w-6 h-6 text-[#FFD700] flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-white font-semibold mb-1">Location</h3>
                    <p className="text-white/90">Maguey Delaware</p>
                    <p className="text-white/90">3320 Old Capitol Trl</p>
                    <p className="text-white/90">Wilmington, DE 19808</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <Phone className="w-6 h-6 text-[#FFD700] flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-white font-semibold mb-1">Phone</h3>
                    <p className="text-white/90"><a href="tel:3026602669" className="hover:text-[#FFD700] transition-colors">(302) 660-2669</a></p>
                    <p className="text-white/90 mt-2"><a href="mailto:info@elmagueydelaware.com" className="hover:text-[#FFD700] transition-colors text-sm">info@elmagueydelaware.com</a></p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <Clock className="w-6 h-6 text-[#FFD700] flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-white font-semibold mb-1">Hours</h3>
                    <p className="text-white/90">Monday - Saturday: 11:00 AM - 9:00 PM</p>
                    <p className="text-white/90 font-semibold">Sunday: 12:00 PM - 10:00 PM</p>
                    <p className="text-[#FFD700] text-sm mt-1">*Seafood Specials on Sunday</p>
                  </div>
                </div>
              </div>
              
              <Button className="w-full mt-8 bg-white text-[#8B0000] hover:bg-white/90 font-bold">
                CONTACT US
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Floating Cart Button */}
      <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
        <SheetTrigger asChild>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="fixed bottom-8 right-8 z-40"
          >
            <Button
              size="lg"
              className="rounded-full w-16 h-16 bg-[#8B0000] hover:bg-[#A52A2A] text-white shadow-lg relative"
            >
              <ShoppingCart className="w-6 h-6" />
              {getTotalItems() > 0 && (
                <span className="absolute -top-2 -right-2 bg-[#FFD700] text-[#8B0000] rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                  {getTotalItems()}
                </span>
              )}
            </Button>
          </motion.div>
        </SheetTrigger>
        <SheetContent side="right" className="w-full sm:max-w-lg bg-black border-l border-white/10 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-white text-2xl font-black tracking-wider text-center">
              YOUR ORDER
            </SheetTitle>
          </SheetHeader>

          <div className="mt-8 space-y-6">
            {/* Order Type Selection */}
            <div className="flex gap-4 mb-6">
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

            {/* Cart Items */}
            {cart.length === 0 ? (
              <p className="text-white/60 text-center py-12">Your cart is empty</p>
            ) : (
              <>
                <div className="space-y-3 mb-6">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10"
                    >
                      <div className="flex-1">
                        <h4 className="text-white font-semibold text-sm">{item.name}</h4>
                        <p className="text-white/60 text-xs mt-1">
                          ${(item.salePrice || item.price).toFixed(2)} each
                          {item.salePrice && (
                            <span className="text-white/40 line-through ml-2">
                              ${item.price.toFixed(2)}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeFromCart(item.id)}
                          className="w-8 h-8 p-0 text-white hover:bg-white/10"
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="text-white font-bold w-6 text-center text-sm">{item.quantity}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => addToCart(item)}
                          className="w-8 h-8 p-0 text-white hover:bg-white/10"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total */}
                <div className="border-t border-white/10 pt-6 mb-6">
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-white text-xl font-bold">Total</span>
                    <span className="text-[#FFD700] text-2xl font-black">
                      ${getTotalPrice().toFixed(2)}
                    </span>
                  </div>

                  {/* Customer Info Form */}
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
                    <Input
                      placeholder="Special Instructions (optional)"
                      value={customerInfo.specialInstructions}
                      onChange={(e) =>
                        setCustomerInfo({ ...customerInfo, specialInstructions: e.target.value })
                      }
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                    />
                    <Button
                      type="submit"
                      className="w-full bg-[#8B0000] hover:bg-[#A52A2A] text-white font-bold py-3"
                    >
                      Place Order
                    </Button>
                  </form>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Footer />
    </div>
  );
};

export default Restaurant;

