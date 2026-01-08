import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const Refund = () => {
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

        <h1 className="text-4xl font-bold mb-8">Refund Policy</h1>
        <p className="text-gray-400 mb-8">Last updated: January 2025</p>

        <div className="space-y-8 text-gray-300">
          <section className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-amber-500 mb-2">Important Notice</h2>
            <p>
              All ticket sales are generally final. Please review event details carefully
              before purchasing. We recommend purchasing tickets only when you are certain
              you can attend.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">1. Standard Ticket Refunds</h2>
            <p className="mb-4">Refunds may be requested under the following conditions:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>
                <strong>48+ hours before event:</strong> Full refund minus a 10% processing fee
              </li>
              <li>
                <strong>24-48 hours before event:</strong> 50% refund
              </li>
              <li>
                <strong>Less than 24 hours before event:</strong> No refund available
              </li>
              <li>
                <strong>After event start time:</strong> No refund available
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">2. Event Cancellation</h2>
            <p className="mb-4">
              If Maguey Nightclub cancels an event:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>You will receive a <strong>full refund</strong> including all fees</li>
              <li>Refunds will be processed within 5-7 business days</li>
              <li>You will be notified via email at the address used for purchase</li>
              <li>No action is required on your part; refunds are automatic</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">3. Event Postponement</h2>
            <p className="mb-4">
              If an event is rescheduled to a new date:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Your tickets will automatically be valid for the new date</li>
              <li>If you cannot attend the new date, you may request a refund within 7 days of the announcement</li>
              <li>Refund requests for postponed events receive full refund minus processing fees</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">4. VIP Table Reservations</h2>
            <p className="mb-4">VIP table bookings have different refund terms:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>
                <strong>7+ days before event:</strong> Full refund minus 20% deposit
              </li>
              <li>
                <strong>3-7 days before event:</strong> 50% refund
              </li>
              <li>
                <strong>Less than 3 days before event:</strong> No refund available
              </li>
            </ul>
            <p className="mt-4">
              VIP deposits are non-refundable but may be applied to a future reservation
              at management's discretion.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">5. Non-Refundable Circumstances</h2>
            <p className="mb-4">Refunds are not available for:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Denied entry due to invalid ID or failure to meet age requirements</li>
              <li>Denied entry due to violation of venue policies or dress code</li>
              <li>Removal from venue due to disruptive behavior</li>
              <li>Changed plans, scheduling conflicts, or personal emergencies</li>
              <li>Tickets purchased from unauthorized resellers</li>
              <li>Weather conditions (events are held rain or shine unless cancelled)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">6. How to Request a Refund</h2>
            <p className="mb-4">To request a refund:</p>
            <ol className="list-decimal list-inside space-y-2 ml-4">
              <li>Email refunds@maguey.club with your order number</li>
              <li>Include the email address used for the purchase</li>
              <li>State the reason for your refund request</li>
              <li>Allow 2-3 business days for review</li>
            </ol>
            <p className="mt-4">
              Approved refunds are processed to the original payment method within
              5-7 business days after approval.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">7. Processing Fees</h2>
            <p>
              Please note that payment processing fees charged by our payment provider
              (Stripe) are non-refundable. These fees are typically 2.9% + $0.30 per
              transaction.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">8. Contact</h2>
            <p>
              For refund inquiries, please contact:
            </p>
            <p className="mt-4 text-amber-500">
              Email: refunds@maguey.club
            </p>
            <p className="text-gray-400 mt-2">
              Response time: 1-2 business days
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-800">
          <div className="flex gap-4 text-sm text-gray-400">
            <Link to="/privacy" className="hover:text-amber-500">Privacy Policy</Link>
            <span>•</span>
            <Link to="/terms" className="hover:text-amber-500">Terms of Service</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Refund;
