import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const Terms = () => {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Link
          to="/"
          className="inline-flex items-center text-amber-500 hover:text-amber-400 mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Events
        </Link>

        <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
        <p className="text-gray-400 mb-8">Last updated: January 2025</p>

        <div className="space-y-8 text-gray-300">
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">1. Acceptance of Terms</h2>
            <p>
              By purchasing tickets through Maguey Pass Lounge, you agree to these Terms of
              Service. If you do not agree with any part of these terms, please do not use
              our services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">2. Age Requirements</h2>
            <p className="mb-4">
              <strong className="text-amber-500">You must be 21 years of age or older</strong> to
              purchase tickets and attend events at Maguey Nightclub. Valid government-issued
              photo identification is required for entry.
            </p>
            <p>
              We reserve the right to refuse entry to anyone who cannot provide valid ID
              or appears to be under the influence.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">3. Ticket Terms</h2>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>All ticket sales are final unless otherwise specified</li>
              <li>Tickets are non-transferable without prior authorization</li>
              <li>Each ticket is valid for single entry only (unless re-entry is specified)</li>
              <li>Duplicate tickets will be voided; only the original purchaser may enter</li>
              <li>Resale of tickets above face value is prohibited</li>
              <li>We reserve the right to cancel fraudulent orders without refund</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">4. Event Entry</h2>
            <p className="mb-4">Upon entry, you agree to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Present a valid QR code ticket for scanning</li>
              <li>Show valid government-issued photo ID</li>
              <li>Submit to security screening if requested</li>
              <li>Follow all venue rules and staff instructions</li>
              <li>Not bring prohibited items (weapons, drugs, outside beverages, professional cameras)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">5. Venue Rights</h2>
            <p className="mb-4">Maguey Nightclub reserves the right to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Refuse entry or remove any person for any reason</li>
              <li>Change event lineups, times, or dates</li>
              <li>Cancel events due to unforeseen circumstances (full refund will be provided)</li>
              <li>Implement dress codes and enforce venue policies</li>
              <li>Use photography and video taken at events for promotional purposes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">6. VIP Table Reservations</h2>
            <p className="mb-4">For VIP table bookings:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Minimum spend requirements apply as stated at booking</li>
              <li>Reservations must be claimed within 1 hour of event start</li>
              <li>Table assignments are at venue discretion and may vary from floor plan</li>
              <li>Bottle service and menu prices are subject to service charge and tax</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">7. Liability</h2>
            <p>
              Maguey Nightclub is not liable for personal injury, property damage, or loss
              that occurs on the premises, except where caused by gross negligence. You
              attend events at your own risk and are responsible for your own safety and
              belongings.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">8. Dispute Resolution</h2>
            <p>
              Any disputes arising from ticket purchases or event attendance shall be
              resolved through binding arbitration in accordance with the laws of the
              State of Delaware. You waive the right to participate in class action lawsuits.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">9. Changes to Terms</h2>
            <p>
              We may update these Terms of Service at any time. Continued use of our
              services after changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">10. Contact</h2>
            <p>
              For questions about these Terms of Service, contact us at:
            </p>
            <p className="mt-4 text-amber-500">
              Email: legal@maguey.club
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-800">
          <div className="flex gap-4 text-sm text-gray-400">
            <Link to="/privacy" className="hover:text-amber-500">Privacy Policy</Link>
            <span>•</span>
            <Link to="/refund" className="hover:text-amber-500">Refund Policy</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Terms;
