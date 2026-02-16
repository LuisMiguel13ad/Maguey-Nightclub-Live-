import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";
import { Briefcase, Users, Clock, Mail, MapPin } from "lucide-react";

const Careers = () => {
  const positions = [
    {
      title: "Bartender",
      department: "Bar",
      type: "Part-time / Full-time",
      description: "Experienced bartender needed for high-volume nightclub environment. Must have knowledge of craft cocktails and excellent customer service skills."
    },
    {
      title: "Security Staff",
      department: "Security",
      type: "Part-time",
      description: "Professional security personnel to ensure guest safety. Previous security experience preferred. Must be able to work late nights and weekends."
    },
    {
      title: "VIP Server",
      department: "Service",
      type: "Part-time / Full-time",
      description: "Dedicated server for VIP tables and bottle service. Must provide exceptional service and maintain professionalism in fast-paced environment."
    },
    {
      title: "DJ / Music Curator",
      department: "Entertainment",
      type: "Contract",
      description: "Experienced DJ with knowledge of Latin music genres (Reggaeton, Cumbia, Regional Mexicano). Must have own equipment and ability to read the crowd."
    }
  ];

  return (
    <div className="min-h-screen bg-black">
      {/* Navigation */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <Navigation />
      </div>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 bg-black">
        <div className="container mx-auto max-w-4xl text-center">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-5xl md:text-7xl font-black text-white mb-6 tracking-wider drop-shadow-[0_0_30px_rgba(255,0,180,0.25)]"
          >
            CAREERS
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
            className="text-xl text-white/80 max-w-2xl mx-auto leading-relaxed"
          >
            Join the Maguey team and be part of Delaware's premier Latin nightlife experience
          </motion.p>
        </div>
      </section>

      {/* Why Work With Us */}
      <section className="py-20 px-4 bg-black">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-gradient-to-br from-pink-500/10 to-purple-500/10 backdrop-blur-md border border-white/10 rounded-3xl p-8 md:p-12 mb-12"
          >
            <h2 className="text-3xl font-bold text-white mb-6 text-center">Why Work at Maguey?</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="bg-gradient-to-br from-pink-500/30 to-purple-500/30 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Users className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Dynamic Team</h3>
                <p className="text-white/80">Work with passionate professionals in a fast-paced, exciting environment.</p>
              </div>
              <div className="text-center">
                <div className="bg-gradient-to-br from-pink-500/30 to-purple-500/30 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Clock className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Flexible Schedules</h3>
                <p className="text-white/80">We offer flexible scheduling options to fit your lifestyle and commitments.</p>
              </div>
              <div className="text-center">
                <div className="bg-gradient-to-br from-pink-500/30 to-purple-500/30 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Briefcase className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Growth Opportunities</h3>
                <p className="text-white/80">Advance your career with training programs and promotion opportunities.</p>
              </div>
            </div>
          </motion.div>

          {/* Open Positions */}
          <div className="space-y-6 mb-12">
            <h2 className="text-3xl font-bold text-white mb-8 text-center">Open Positions</h2>
            {positions.map((position, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all duration-300"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Briefcase className="w-5 h-5 text-pink-500" />
                      <h3 className="text-xl font-semibold text-white">{position.title}</h3>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-white/60 mb-3">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {position.department}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {position.type}
                      </span>
                    </div>
                    <p className="text-white/80">{position.description}</p>
                  </div>
                  <a href="/contact">
                    <button className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white border-0 px-6 py-3 font-semibold tracking-wider rounded-xl shadow-[0_0_20px_rgba(255,0,180,0.25)] transition-all duration-300 whitespace-nowrap">
                      Apply Now
                    </button>
                  </a>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Application Process */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-8 md:p-12"
          >
            <div className="flex justify-center mb-6">
              <div className="bg-gradient-to-br from-pink-500/30 to-purple-500/30 rounded-full p-4">
                <Mail className="w-8 h-8 text-white" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-white mb-4 text-center">How to Apply</h3>
            <p className="text-white/80 text-center mb-6 max-w-2xl mx-auto">
              Interested in joining our team? Send us your resume and cover letter. Please include the position you're applying for in the subject line.
            </p>
            <div className="text-center">
              <a href="/contact">
                <button className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white border-0 text-lg px-8 py-4 font-semibold tracking-wider rounded-2xl shadow-[0_0_30px_rgba(255,0,180,0.35)] transition-all duration-300">
                  <Mail className="w-5 h-5 inline mr-2" />
                  Contact Us to Apply
                </button>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Careers;

