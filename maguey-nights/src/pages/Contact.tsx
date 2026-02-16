import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Phone, Mail, Clock } from "lucide-react";
import { motion } from "framer-motion";

const Contact = () => {
  const [formData, setFormData] = useState({
    topic: "",
    name: "",
    email: "",
    phone: "",
    subject: "",
    venue: "",
    startTime: "",
    endTime: "",
    message: ""
  });

  // Optimized motion variants for better performance
  const fadeUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, ease: "easeOut" }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert("Thank you for contacting us! We'll get back to you soon.");
    setFormData({
      topic: "",
      name: "",
      email: "",
      phone: "",
      subject: "",
      venue: "",
      startTime: "",
      endTime: "",
      message: ""
    });
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Navigation */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <Navigation />
      </div>

      {/* Hero Section */}
      <section className="pt-40 pb-24 px-4 bg-black">
        <div className="container mx-auto max-w-7xl text-center">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-5xl md:text-7xl font-black text-white mb-6 tracking-wider drop-shadow-[0_0_30px_rgba(255,0,180,0.25)]"
          >
            CONTACT US
          </motion.h1>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-20 px-4 bg-black">
        <div className="container mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
            {/* Left Column - Contact Information */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <h2 className="text-white text-2xl font-light mb-12 tracking-wider">GET IN TOUCH</h2>
              
              {/* General Inquiries */}
              <div className="mb-12">
                <h3 className="text-white text-xl font-light mb-6 tracking-wide animate-fade-in-slow">CONTACT</h3>
                <div className="space-y-6">
                  <div>
                    <h4 className="text-gray-400 text-sm uppercase tracking-widest mb-2">general inquiries</h4>
                    <p className="text-white mb-2"><a href="mailto:info@elmagueydelaware.com" className="hover:text-pink-500 transition-colors">info@elmagueydelaware.com</a></p>
                    <p className="text-white"><a href="tel:3026602669" className="hover:text-pink-500 transition-colors">(302) 660-2669</a></p>
                    <p className="text-white mt-2">3320 Old Capitol Trl<br />Wilmington, DE 19808</p>
                  </div>

                  <div>
                    <h4 className="text-gray-400 text-sm uppercase tracking-widest mb-2">reservations</h4>
                    <p className="text-white">reservations@magueynightclub.com</p>
                  </div>

                  <div>
                    <h4 className="text-gray-400 text-sm uppercase tracking-widest mb-2">press inquiries</h4>
                    <p className="text-white">press@magueynightclub.com</p>
                  </div>
                </div>
              </div>

              {/* Hours */}
              <div>
                <h3 className="text-white text-xl font-light mb-6 tracking-wide animate-fade-in-slow">HOURS</h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-gray-400 text-sm uppercase tracking-widest mb-2">RESTAURANT & NIGHTCLUB</h4>
                    <div className="space-y-2 text-white text-sm">
                      <p><span className="text-gray-400">Monday:</span> 10 AM - 10 PM</p>
                      <p><span className="text-gray-400">Tuesday:</span> 10 AM - 2 AM</p>
                      <p><span className="text-gray-400">Wednesday:</span> <span className="text-gray-500">Closed</span></p>
                      <p><span className="text-gray-400">Thursday:</span> 10 AM - 10 PM</p>
                      <p><span className="text-gray-400">Friday:</span> 10 AM - 2 AM</p>
                      <p><span className="text-gray-400">Saturday:</span> 10 AM - 2 AM</p>
                      <p><span className="text-gray-400">Sunday:</span> 10 AM - 2 AM</p>
                    </div>
                    <p className="text-gray-400 text-xs mt-4 italic">Mexican eatery by day, nightclub by night</p>
                  </div>
                  <div>
                    <h4 className="text-gray-400 text-sm uppercase tracking-widest mb-2">SPECIAL EVENTS</h4>
                    <p className="text-white">Check Calendar</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Right Column - Contact Form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
            >
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-white text-sm uppercase tracking-widest mb-3">Topic*</label>
                  <Select name="topic" value={formData.topic} onValueChange={(value) => setFormData({...formData, topic: value})}>
                    <SelectTrigger className="bg-transparent border-gray-800 text-white rounded-none h-12">
                      <SelectValue placeholder="Select a topic" />
                    </SelectTrigger>
                    <SelectContent className="bg-black border-gray-800">
                      <SelectItem value="general" className="text-white">General Inquiries</SelectItem>
                      <SelectItem value="bottle" className="text-white">Bottle Service</SelectItem>
                      <SelectItem value="parties" className="text-white">Bachelor & Bachelorette Parties</SelectItem>
                      <SelectItem value="press" className="text-white">Press Inquiries</SelectItem>
                      <SelectItem value="lost" className="text-white">Lost & Found</SelectItem>
                      <SelectItem value="corporate" className="text-white">Corporate Events</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-white text-sm uppercase tracking-widest mb-3">Full Name*</label>
                  <Input
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="bg-transparent border-gray-800 text-white rounded-none h-12"
                    required
                  />
                </div>

                <div>
                  <label className="block text-white text-sm uppercase tracking-widest mb-3">Email*</label>
                  <Input
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="bg-transparent border-gray-800 text-white rounded-none h-12"
                    required
                  />
                </div>

                <div>
                  <label className="block text-white text-sm uppercase tracking-widest mb-3">Phone*</label>
                  <Input
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="bg-transparent border-gray-800 text-white rounded-none h-12"
                    required
                  />
                </div>

                <div>
                  <label className="block text-white text-sm uppercase tracking-widest mb-3">Subject*</label>
                  <Input
                    name="subject"
                    value={formData.subject}
                    onChange={handleInputChange}
                    className="bg-transparent border-gray-800 text-white rounded-none h-12"
                    required
                  />
                </div>

                <div>
                  <label className="block text-white text-sm uppercase tracking-widest mb-3">Venue</label>
                  <Select name="venue" value={formData.venue} onValueChange={(value) => setFormData({...formData, venue: value})}>
                    <SelectTrigger className="bg-transparent border-gray-800 text-white rounded-none h-12">
                      <SelectValue placeholder="Select Venue" />
                    </SelectTrigger>
                    <SelectContent className="bg-black border-gray-800">
                      <SelectItem value="nightclub" className="text-white">Maguey Nightclub</SelectItem>
                      <SelectItem value="vip" className="text-white">VIP Lounge</SelectItem>
                      <SelectItem value="mainstage" className="text-white">Main Stage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white text-sm uppercase tracking-widest mb-3">Start time</label>
                    <Input
                      name="startTime"
                      type="time"
                      value={formData.startTime}
                      onChange={handleInputChange}
                      className="bg-transparent border-gray-800 text-white rounded-none h-12"
                    />
                  </div>
                  <div>
                    <label className="block text-white text-sm uppercase tracking-widest mb-3">End time</label>
                    <Input
                      name="endTime"
                      type="time"
                      value={formData.endTime}
                      onChange={handleInputChange}
                      className="bg-transparent border-gray-800 text-white rounded-none h-12"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-white text-sm uppercase tracking-widest mb-3">Message</label>
                  <Textarea
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    className="bg-transparent border-gray-800 text-white rounded-none min-h-[150px]"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full group bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white/15 font-semibold text-lg py-6 rounded-2xl shadow-[0_0_30px_rgba(255,0,180,0.25)] transition-all duration-300 mt-8"
                >
                  <span className="relative">
                    Submit
                    <span className="absolute -inset-1 -z-10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 glow" />
                  </span>
                </Button>
              </form>
            </motion.div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Contact;
