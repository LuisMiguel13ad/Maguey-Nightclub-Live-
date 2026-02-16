import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";
import { HelpCircle, ChevronDown } from "lucide-react";
import { useState } from "react";

interface FAQItem {
  question: string;
  answer: string;
}

const faqData: FAQItem[] = [
  {
    question: "What is the dress code?",
    answer: "We maintain an upscale dress code. Smart casual to upscale attire is required. No athletic wear, flip-flops, or excessively casual clothing. Management reserves the right to refuse entry based on dress code."
  },
  {
    question: "What are your hours?",
    answer: "Maguey Nightclub is open Thursday through Saturday from 9:00 PM to 2:00 AM. Special events may have extended hours. Check individual event pages for specific times."
  },
  {
    question: "Do you offer VIP tables and bottle service?",
    answer: "Yes! We offer premium VIP table reservations with bottle service. VIP packages include priority entry, reserved seating, dedicated server, and premium bottle selections. Contact us or check event pages for availability and pricing."
  },
  {
    question: "What forms of payment do you accept?",
    answer: "We accept all major credit cards, debit cards, and cash. VIP table reservations and bottle service can be paid in advance online or at the venue."
  },
  {
    question: "Are tickets refundable?",
    answer: "All ticket sales are final. Refunds are only available if an event is cancelled by the venue. In case of rescheduling, tickets will be valid for the new date or refunds will be offered."
  },
  {
    question: "What is your age policy?",
    answer: "All events are 21+ unless otherwise specified. Valid government-issued photo ID is required for entry. We strictly enforce age restrictions."
  },
  {
    question: "Do you have parking available?",
    answer: "Limited parking is available near the venue. We recommend using rideshare services or public transportation for convenience. Valet parking may be available for VIP guests."
  },
  {
    question: "Can I bring a large group?",
    answer: "Yes! We welcome groups and offer special packages for parties of 8 or more. Contact us in advance to arrange group reservations and discuss special accommodations."
  },
  {
    question: "What music genres do you play?",
    answer: "Maguey specializes in Latin music including Reggaeton, Cumbia, Regional Mexicano, Banda, and more. We also host special themed nights and DJ events."
  },
  {
    question: "Do you serve food?",
    answer: "We offer a selection of appetizers and light bites. Our focus is on premium cocktails and bottle service. For full dining options, check out our restaurant section."
  },
  {
    question: "How do I join the waitlist for sold-out events?",
    answer: "If an event is sold out, you can join the waitlist directly on the event page. We'll notify you if tickets become available. Waitlist notifications are sent on a first-come, first-served basis."
  },
  {
    question: "What happens if I lose my ticket?",
    answer: "If you purchased tickets through our website, you can access them anytime through your account. If you need assistance, contact our support team with your order confirmation email."
  }
];

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

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
            FREQUENTLY ASKED QUESTIONS
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
            className="text-xl text-white/80 max-w-2xl mx-auto leading-relaxed"
          >
            Everything you need to know about Maguey Nightclub
          </motion.p>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-4 bg-black">
        <div className="container mx-auto max-w-4xl">
          <div className="space-y-4">
            {faqData.map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-all duration-300"
              >
                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full p-6 text-left flex items-center justify-between gap-4 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="bg-gradient-to-br from-pink-500/30 to-purple-500/30 rounded-full p-2 flex-shrink-0">
                      <HelpCircle className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">{faq.question}</h3>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-white/60 flex-shrink-0 transition-transform duration-300 ${
                      openIndex === index ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {openIndex === index && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="px-6 pb-6"
                  >
                    <p className="text-white/80 leading-relaxed pl-12">
                      {faq.answer}
                    </p>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Contact CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mt-12 bg-gradient-to-br from-pink-500/10 to-purple-500/10 backdrop-blur-md border border-white/10 rounded-3xl p-8 md:p-12 text-center"
          >
            <h3 className="text-2xl font-bold text-white mb-4">Still Have Questions?</h3>
            <p className="text-white/80 mb-6">
              Can't find what you're looking for? Our team is here to help.
            </p>
            <a href="/contact">
              <button className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white border-0 text-lg px-8 py-4 font-semibold tracking-wider rounded-2xl shadow-[0_0_30px_rgba(255,0,180,0.35)] transition-all duration-300">
                Contact Us
              </button>
            </a>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default FAQ;

