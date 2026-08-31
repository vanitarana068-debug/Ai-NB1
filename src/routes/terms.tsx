import { createFileRoute, Link } from "@tanstack/react-router";

import { LegalLayout } from "@/components/legal-layout";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Terms of Service — Northbridge" },
      { name: "description", content: "The terms that govern your use of the Northbridge store." },
    ],
  }),
});

function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" updated="31 August 2026">
      <p>
        These Terms of Service ("Terms") govern your access to and use of the Northbridge website
        and your purchase of products from us ("Northbridge", "we", "us"). By using the site or
        placing an order you agree to these Terms. If you do not agree, please do not use the site.
      </p>

      <h2>1. Who we are</h2>
      <p>
        Northbridge is operated by [legal entity name], registered at [registered address], company
        number [number]. You can reach us using the contact details in the site footer.
      </p>

      <h2>2. Eligibility and your account</h2>
      <p>
        You must be at least 18 years old, or the age of majority in your jurisdiction, to place an
        order. If you create an account you are responsible for keeping your password secure and for
        all activity under your account. Tell us promptly if you believe your account has been used
        without your permission.
      </p>

      <h2>3. Products and availability</h2>
      <p>
        We try to describe and picture products accurately, but we do not warrant that descriptions,
        images, or other content are complete or error-free. Stock is limited and shown at the point
        of ordering; a product being visible does not guarantee availability.
      </p>

      <h2>4. Prices and orders</h2>
      <p>
        Prices are shown at checkout and are calculated by us at that time. Your order is an offer
        to buy; a contract is formed only when we confirm the order. We may decline or cancel an
        order — for example if a product is out of stock, mispriced, or the payment cannot be
        verified — and if we do we will not charge you, or we will refund any amount taken.
      </p>

      <h2>5. Payment</h2>
      <p>
        Payments are processed by our payment provider, Razorpay. We do not receive or store your
        full card details. By paying you authorise us (via the provider) to charge the amount shown
        for your order. See our <Link to="/privacy">Privacy Policy</Link> for how payment data is
        handled.
      </p>

      <h2>6. Delivery</h2>
      <p>
        We deliver to the address you provide at checkout. Delivery timeframes are estimates, not
        guarantees. Risk in the products passes to you on delivery. Please check the address
        carefully — we are not responsible for orders sent to an incorrect address you supplied.
      </p>

      <h2>7. Returns, cancellations and refunds</h2>
      <p>
        Your rights to cancel, return, and obtain a refund are set out in our{" "}
        <Link to="/returns">Returns &amp; Refunds Policy</Link>, which forms part of these Terms.
      </p>

      <h2>8. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>use the site for any unlawful or fraudulent purpose;</li>
        <li>interfere with the site's operation, security, or other users' use of it;</li>
        <li>attempt to gain unauthorised access to any part of the site or its systems; or</li>
        <li>copy, scrape, or reuse our content except as permitted by law.</li>
      </ul>

      <h2>9. Intellectual property</h2>
      <p>
        All content on the site — including text, images, logos, and the site design — is owned by
        us or our licensors and is protected by law. You may not use it without our permission.
      </p>

      <h2>10. Disclaimers and liability</h2>
      <p>
        The site is provided "as is". To the fullest extent permitted by law we exclude implied
        warranties. Nothing in these Terms limits liability that cannot be limited by law (such as
        for death or personal injury caused by negligence, or for fraud). Subject to that, our total
        liability arising from an order is limited to the amount you paid for that order.
      </p>

      <h2>11. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. The version that applies to your order is the
        one in force when you place it. Continued use of the site after changes means you accept the
        updated Terms.
      </p>

      <h2>12. Governing law</h2>
      <p>
        These Terms are governed by the laws of [jurisdiction], and disputes are subject to the
        courts of [jurisdiction], without affecting any mandatory consumer rights you have where you
        live.
      </p>

      <h2>13. Contact</h2>
      <p>Questions about these Terms? Use the contact details in the site footer.</p>
    </LegalLayout>
  );
}
