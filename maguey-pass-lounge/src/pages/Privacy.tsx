import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const Privacy = () => {
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

        <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
        <p className="text-gray-400 mb-8">Last updated: January 2025</p>

        <div className="space-y-8 text-gray-300">
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">1. Information We Collect</h2>
            <p className="mb-4">
              When you purchase tickets through our platform, we collect the following information:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Name and contact information (email address, phone number)</li>
              <li>Payment information (processed securely through Stripe)</li>
              <li>Event attendance and ticket usage data</li>
              <li>Device and browser information for security purposes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">2. How We Use Your Information</h2>
            <p className="mb-4">We use your information to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Process and fulfill your ticket orders</li>
              <li>Send order confirmations and event updates</li>
              <li>Verify your identity at event entry</li>
              <li>Improve our services and user experience</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">3. Payment Security</h2>
            <p>
              All payment transactions are processed securely through Stripe. We do not store
              your complete credit card information on our servers. Stripe is PCI-DSS compliant
              and uses industry-standard encryption to protect your payment data.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">4. Cookies and Tracking</h2>
            <p className="mb-4">
              We use cookies and similar technologies to:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Keep you logged in to your account</li>
              <li>Remember your preferences</li>
              <li>Analyze website traffic and usage patterns</li>
              <li>Improve our marketing efforts</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">5. Data Sharing</h2>
            <p>
              We do not sell your personal information to third parties. We may share your
              information with service providers who assist us in operating our platform
              (such as payment processors and email services) and when required by law.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">6. Your Rights</h2>
            <p className="mb-4">You have the right to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Access your personal data</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data (subject to legal requirements)</li>
              <li>Opt out of marketing communications</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">7. Data Retention</h2>
            <p>
              We retain your personal information for as long as necessary to provide our
              services and comply with legal obligations. Transaction records are kept for
              a minimum of 7 years for tax and legal purposes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">8. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or your personal data,
              please contact us at:
            </p>
            <p className="mt-4 text-amber-500">
              Email: privacy@maguey.club
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-800">
          <div className="flex gap-4 text-sm text-gray-400">
            <Link to="/terms" className="hover:text-amber-500">Terms of Service</Link>
            <span>•</span>
            <Link to="/refund" className="hover:text-amber-500">Refund Policy</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
