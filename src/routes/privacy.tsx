import { createFileRoute } from "@tanstack/react-router";

import { LegalLayout } from "@/components/legal-layout";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Privacy Policy — Northbridge" },
      { name: "description", content: "How Northbridge collects, uses and protects your data." },
    ],
  }),
});

function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="31 August 2026">
      <p>
        This policy explains what personal data Northbridge ("we", "us") collects, why, and what
        rights you have. The data controller is [legal entity name], [registered address]. Contact
        us using the details in the site footer.
      </p>

      <h2>1. What we collect</h2>
      <ul>
        <li>
          <strong>Account details</strong> — your name, email address, and password (stored hashed),
          when you register.
        </li>
        <li>
          <strong>Order and delivery details</strong> — the name, address, and contact details you
          enter to receive an order, plus what you bought.
        </li>
        <li>
          <strong>Payment information</strong> — handled by our payment provider. We receive
          confirmation that a payment succeeded and a masked reference (for example the method
          used), but we never receive or store your full card number.
        </li>
        <li>
          <strong>Usage data</strong> — basic technical information needed to run the site securely,
          and anything you type into the shop assistant.
        </li>
      </ul>

      <h2>2. How we use it</h2>
      <ul>
        <li>to take, process, and deliver your orders, and to handle returns and support;</li>
        <li>to manage your account and keep it secure;</li>
        <li>to send transactional messages such as order confirmations;</li>
        <li>to meet our legal, tax, and accounting obligations; and</li>
        <li>to detect and prevent fraud and misuse.</li>
      </ul>

      <h2>3. Legal basis</h2>
      <p>
        We process your data to perform our contract with you (fulfilling orders), to comply with
        legal obligations (such as keeping tax records), and for our legitimate interests in running
        and securing the shop — balanced against your rights.
      </p>

      <h2>4. Who we share it with</h2>
      <p>We use trusted service providers who process data only on our instructions:</p>
      <ul>
        <li>
          <strong>Supabase</strong> — hosts our database and handles account authentication.
        </li>
        <li>
          <strong>Razorpay</strong> — processes payments. Card details go directly to Razorpay and
          are governed by their privacy policy.
        </li>
        <li>
          <strong>Brevo</strong> — sends order-confirmation and transactional email on our behalf.
        </li>
        <li>
          <strong>Anthropic</strong> — powers the optional shop assistant; messages you send it are
          processed to generate a reply.
        </li>
      </ul>
      <p>We do not sell your personal data. We may disclose data where required by law.</p>

      <h2>5. Cookies and local storage</h2>
      <p>
        We use your browser's local storage to keep your basket and to remember your signed-in
        session. These are essential to the site working and are not used for advertising.
      </p>

      <h2>6. How long we keep it</h2>
      <p>
        We keep order records for as long as needed to fulfil the order and to meet legal and
        accounting requirements, and account data until you ask us to delete your account. We then
        delete or anonymise it, unless the law requires us to keep it longer.
      </p>

      <h2>7. Your rights</h2>
      <p>
        Depending on where you live, you may have the right to access, correct, delete, or export
        your data, to object to or restrict certain processing, and to withdraw consent. To exercise
        any of these, contact us using the details in the footer. You can also update your saved
        details, and see your orders, on your account page.
      </p>

      <h2>8. Security</h2>
      <p>
        Access to stored data is restricted by row-level security so that, in normal use, you can
        only see your own account and orders. No system is perfectly secure, but we take reasonable
        measures to protect your data.
      </p>

      <h2>9. Children</h2>
      <p>The site is not intended for children, and we do not knowingly collect their data.</p>

      <h2>10. Changes</h2>
      <p>
        We may update this policy; the "last updated" date above shows when. Significant changes
        will be made clear on this page.
      </p>

      <h2>11. Contact</h2>
      <p>
        To ask about this policy or exercise your rights, use the contact details in the site
        footer. You may also have the right to complain to your local data-protection authority.
      </p>
    </LegalLayout>
  );
}
