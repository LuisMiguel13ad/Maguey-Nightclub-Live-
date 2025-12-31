import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";
import { Shield, FileText, Lock } from "lucide-react";

const Policies = () => {
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
            POLICIES
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
            className="text-xl text-white/80 max-w-2xl mx-auto leading-relaxed"
          >
            Terms of Service and Privacy Policy
          </motion.p>
        </div>
      </section>

      {/* Content Section */}
      <section className="py-20 px-4 bg-black">
        <div className="container mx-auto max-w-4xl">
          <div className="space-y-12">
            {/* Terms of Service */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-8 md:p-12"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="bg-gradient-to-br from-pink-500/30 to-purple-500/30 rounded-full p-3">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-white">Terms of Service</h2>
              </div>
              <div className="space-y-6 text-white/80 leading-relaxed">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-3">1. Acceptance of Terms</h3>
                  <p>
                    By accessing and using Maguey Nightclub's website and services, you accept and agree to be bound by the terms and provision of this agreement.
                  </p>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-3">2. Ticket Purchases</h3>
                  <p>
                    All ticket sales are final. Refunds are only available in accordance with our refund policy. Tickets are non-transferable unless explicitly stated otherwise. We reserve the right to refuse admission or remove any person from the venue.
                  </p>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-3">3. Age Restrictions</h3>
                  <p>
                    All events are 21+ unless otherwise specified. Valid government-issued ID is required for entry. We reserve the right to verify age and refuse entry to anyone who cannot provide valid identification.
                  </p>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-3">4. Code of Conduct</h3>
                  <p>
                    Guests are expected to behave respectfully. Any disruptive, threatening, or illegal behavior will result in immediate removal from the venue without refund. We reserve the right to ban individuals from future events.
                  </p>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-3">5. Event Changes</h3>
                  <p>
                    We reserve the right to modify, reschedule, or cancel events. In case of cancellation, ticket holders will be notified and offered refunds or alternative arrangements.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Privacy Policy */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-8 md:p-12"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="bg-gradient-to-br from-pink-500/30 to-purple-500/30 rounded-full p-3">
                  <Lock className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-white">Privacy Policy</h2>
              </div>
              <div className="space-y-6 text-white/80 leading-relaxed">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-3">1. Information We Collect</h3>
                  <p>
                    We collect information you provide directly to us, including name, email address, phone number, payment information, and any other information you choose to provide when purchasing tickets or creating an account.
                  </p>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-3">2. How We Use Your Information</h3>
                  <p>
                    We use the information we collect to process transactions, send you updates about events, improve our services, and communicate with you. We do not sell your personal information to third parties.
                  </p>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-3">3. Data Security</h3>
                  <p>
                    We implement appropriate security measures to protect your personal information. However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.
                  </p>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-3">4. Cookies and Tracking</h3>
                  <p>
                    We use cookies and similar tracking technologies to track activity on our website and hold certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.
                  </p>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-3">5. Your Rights</h3>
                  <p>
                    You have the right to access, update, or delete your personal information at any time. You may also opt out of marketing communications by following the unsubscribe link in our emails.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Contact Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="bg-gradient-to-br from-pink-500/10 to-purple-500/10 backdrop-blur-md border border-white/10 rounded-3xl p-8 md:p-12 text-center"
            >
              <div className="flex justify-center mb-4">
                <div className="bg-gradient-to-br from-pink-500/30 to-purple-500/30 rounded-full p-3">
                  <Shield className="w-6 h-6 text-white" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Questions About Our Policies?</h3>
              <p className="text-white/80 mb-6">
                If you have any questions about these Terms of Service or Privacy Policy, please contact us.
              </p>
              <a href="/contact">
                <button className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white border-0 text-lg px-8 py-4 font-semibold tracking-wider rounded-2xl shadow-[0_0_30px_rgba(255,0,180,0.35)] transition-all duration-300">
                  Contact Us
                </button>
              </a>
            </motion.div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Policies;

