import { createFileRoute, Link } from "@tanstack/react-router";

import { LegalLayout } from "@/components/legal-layout";

export const Route = createFileRoute("/returns")({
  component: ReturnsPage,
  head: () => ({
    meta: [
      { title: "Returns & Refunds — Northbridge" },
      { name: "description", content: "How to cancel, return an item, and get a refund." },
    ],
  }),
});

function ReturnsPage() {
  return (
    <LegalLayout title="Returns & Refunds" updated="31 August 2026">
      <p>
        We want you to be happy with your purchase. This policy explains how to cancel an order,
        return an item, and get a refund. It sits alongside, and does not affect, your statutory
        rights.
      </p>

      <h2>1. Cancelling before dispatch</h2>
      <p>
        If your order has not yet been dispatched, contact us and we will cancel it and refund you
        in full.
      </p>

      <h2>2. Returning an item after delivery</h2>
      <p>
        You may return most items within <strong>[14] days</strong> of delivery for a refund,
        provided they are unused, in their original condition, and in the original packaging with
        any seals intact. Please include your order reference.
      </p>

      <h2>3. Items we can't accept back</h2>
      <ul>
        <li>items that have been used, installed, or activated, unless they are faulty;</li>
        <li>software, digital licences, or consumables once the seal is broken; and</li>
        <li>items damaged by misuse after delivery.</li>
      </ul>

      <h2>4. Faulty or incorrect items</h2>
      <p>
        If an item arrives faulty, damaged, or not as described, contact us as soon as you can. You
        are entitled to a repair, replacement, or refund in line with your statutory rights, and we
        will cover the cost of returning a faulty or incorrect item.
      </p>

      <h2>5. How to start a return</h2>
      <p>
        Contact us using the details in the site footer with your order reference (shown on your{" "}
        <Link to="/account">account page</Link>) and a short note on what you'd like to do. We'll
        reply with return instructions.
      </p>

      <h2>6. Refunds</h2>
      <p>
        Once we receive and check the returned item, we'll process your refund to the original
        payment method via our payment provider, Razorpay. Refunds are typically completed within
        <strong> [5–10] business days</strong>, depending on your bank. We refund the price of the
        item; original delivery charges are refunded only where the item was faulty or incorrect, or
        where the law requires it.
      </p>

      <h2>7. Return shipping costs</h2>
      <p>
        Where you return an item that is not faulty simply because you changed your mind, you are
        responsible for the cost of returning it. For faulty or incorrect items, we cover it.
      </p>

      <h2>8. Warranty</h2>
      <p>
        Many products carry a manufacturer's warranty in addition to your rights under this policy.
        Keep your order reference as proof of purchase for any warranty claim.
      </p>

      <h2>9. Contact</h2>
      <p>Need help with a return? Reach us using the contact details in the site footer.</p>
    </LegalLayout>
  );
}
