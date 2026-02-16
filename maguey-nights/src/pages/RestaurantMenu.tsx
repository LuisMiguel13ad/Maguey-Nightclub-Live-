import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, ShoppingCart } from "lucide-react";
import { motion } from "framer-motion";

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  salePrice?: number;
}

interface CartItem extends MenuItem {
  quantity: number;
}

// Same menu items as Restaurant page
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
  
  // PLATTERS
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
  
  // DOMINGOS MARISQUEROS
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
  
  // BEBIDAS
  { id: "d1", name: "Pina Colada", description: "Must be 21+ (Please show ID)", price: 8.00, category: "drinks" },
  { id: "d2", name: "Margarita", description: "Must be 21+ (Please show ID)", price: 8.00, category: "drinks" },
  { id: "d3", name: "El Jarrito Diablito", description: "Must be 21+ (Please show ID)", price: 10.00, category: "drinks" },
];

const menuCategories = [
  { id: "tacos", name: "🌮 TACOS" },
  { id: "appetizers", name: "🧀 APPETIZERS" },
  { id: "platters", name: "🍽️ PLATTERS" },
  { id: "fajitas", name: "🌶️ FAJITAS" },
  { id: "antojitos", name: "🫔 ANTOJITOS" },
  { id: "seafood", name: "🦐 SEAFOOD" },
  { id: "kids", name: "👶 KID'S MENU" },
  { id: "drinks", name: "🍹 DRINKS" },
];

const RestaurantMenu = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState("tacos");
  const navigate = useNavigate();

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

  const getItemsByCategory = (category: string) => {
    return menuItems.filter((item) => item.category === category);
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

  const handleCheckout = () => {
    if (cart.length === 0) {
      alert("Your cart is empty!");
      return;
    }
    // Store cart in sessionStorage to pass to checkout
    sessionStorage.setItem("restaurantCart", JSON.stringify(cart));
    navigate("/restaurant/checkout");
  };

  return (
    <div className="min-h-screen bg-black">
      <Navigation />
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-16 px-4 bg-black">
        <div className="container mx-auto max-w-6xl text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-4xl md:text-6xl font-black text-white mb-4"
          >
            ORDER ONLINE
          </motion.h1>
          <p className="text-white/70 text-lg">Select your items and proceed to checkout</p>
        </div>
      </section>

      {/* Menu Section */}
      <section className="py-20 px-4 bg-black">
        <div className="container mx-auto max-w-6xl">
          <Tabs value={activeCategory} onValueChange={setActiveCategory} className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:grid-cols-8 mb-8 bg-black/50 border border-white/10 h-auto p-2">
              {menuCategories.map((category) => (
                <TabsTrigger
                  key={category.id}
                  value={category.id}
                  className="data-[state=active]:bg-[#8B0000] data-[state=active]:text-white text-white/70 text-xs md:text-sm px-2 py-2"
                >
                  {category.name.split(' ')[0]}
                </TabsTrigger>
              ))}
            </TabsList>

            {menuCategories.map((category) => {
              const items = getItemsByCategory(category.id);
              if (items.length === 0) return null;

              return (
                <TabsContent key={category.id} value={category.id} className="mt-8">
                  <h3 className="text-2xl md:text-3xl font-bold text-white mb-6 text-center">
                    {category.name}
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {items.map((item) => (
                      <Card
                        key={item.id}
                        className="bg-white/5 backdrop-blur-sm border border-white/10 hover:border-[#FFD700]/50 transition-all duration-300"
                      >
                        <CardContent className="p-6">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1 pr-2">
                              <h4 className="text-lg font-bold text-white mb-2">{item.name}</h4>
                              <p className="text-white/70 text-sm">{item.description}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              {item.salePrice ? (
                                <div>
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

      {/* Floating Cart Button */}
      {cart.length > 0 && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="fixed bottom-8 right-8 z-40"
        >
          <Button
            size="lg"
            onClick={handleCheckout}
            className="rounded-full w-20 h-20 bg-[#8B0000] hover:bg-[#A52A2A] text-white shadow-lg relative flex flex-col items-center justify-center gap-1"
          >
            <ShoppingCart className="w-6 h-6" />
            <span className="text-xs font-bold">{getTotalItems()}</span>
            <span className="text-xs font-bold">${getTotalPrice().toFixed(2)}</span>
          </Button>
        </motion.div>
      )}

      <Footer />
    </div>
  );
};

export default RestaurantMenu;

