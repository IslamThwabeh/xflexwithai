import { Link } from 'wouter';

export function RefundPolicyEn() {
  return (
    <>
      <h2 className="text-xl font-bold text-gray-900">1. Scope of Policy</h2>
      <p>This policy applies to all subscriptions and educational services provided by XFlex Academy, including:</p>
      <ul className="list-disc ps-6 space-y-1">
        <li>Monthly or periodic subscriptions</li>
        <li>Educational packages</li>
        <li>Recommendation channels</li>
        <li>Analysis or AI tools (such as Lex AI)</li>
      </ul>
      <p>This policy is an integral part of the Academy's general Terms and Conditions.</p>

      <h2 className="text-xl font-bold text-gray-900">2. Subscription Policy</h2>
      <ol className="list-decimal ps-6 space-y-2">
        <li>Subscription to Academy services is based on the user's full will and after reviewing the service description and content.</li>
        <li>The user is responsible for choosing the appropriate plan before completing payment.</li>
        <li>A subscription is considered officially activated upon:
          <ul className="list-disc ps-6 mt-1">
            <li>Successful completion of payment, and/or</li>
            <li>Granting the user access to content, channels, or tools.</li>
          </ul>
        </li>
        <li>All subscriptions are personal and non-transferable to another party.</li>
        <li>Sharing login credentials or content with any other person is prohibited.</li>
      </ol>

      <h2 className="text-xl font-bold text-gray-900">3. Refund Policy (No Refunds)</h2>
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="font-semibold text-red-800 mb-2">⚠️ All subscriptions are non-refundable after activation, based on:</p>
        <ul className="list-disc ps-6 space-y-1">
          <li>The nature of digital and educational services.</li>
          <li>Immediate access to content upon activation.</li>
        </ul>
      </div>
      <p className="font-semibold mt-3">The user acknowledges and agrees that:</p>
      <ul className="list-disc ps-6 space-y-1">
        <li>The Academy provides intangible digital content.</li>
        <li>Beginning to use or access the service waives the right to claim a refund.</li>
      </ul>
      <p className="font-semibold mt-3">No refunds are issued in the following cases:</p>
      <ul className="list-disc ps-6 space-y-1">
        <li>Failure to achieve profits or incurring losses.</li>
        <li>User's failure to follow the plan or instructions.</li>
        <li>User changing their mind after subscribing.</li>
        <li>Lack of time or poor follow-through.</li>
        <li>Misuse of recommendations or tools.</li>
        <li>Service not meeting the user's personal expectations.</li>
      </ul>

      <h2 className="text-xl font-bold text-gray-900">4. Exceptional Cases</h2>
      <p>The Academy may, at its sole discretion, consider exceptional cases such as:</p>
      <ul className="list-disc ps-6 space-y-1">
        <li>A severe technical malfunction that completely prevents access to the service and was not resolved within a reasonable timeframe.</li>
      </ul>
      <p className="mt-2">If an exception is approved:</p>
      <ul className="list-disc ps-6 space-y-1">
        <li>The decision is final and not subject to appeal.</li>
        <li>Refunds, if any, are made through the same payment method used.</li>
        <li>The exception does not establish a precedent or acquired right.</li>
      </ul>

      <h2 className="text-xl font-bold text-gray-900">5. Subscription Suspension or Termination</h2>
      <p className="font-semibold">The Academy reserves the right to suspend or terminate a user's subscription without refund in the event of:</p>
      <ul className="list-disc ps-6 space-y-1">
        <li>Violation of terms and conditions.</li>
        <li>Misuse of content.</li>
        <li>Sharing content or recommendations with other parties.</li>
        <li>Abuse towards the Academy, its team, or its reputation.</li>
      </ul>
      <p>No financial obligation on the Academy arises from such termination.</p>

      <h2 className="text-xl font-bold text-gray-900">6. Service Interruptions & Modifications</h2>
      <p>Some services may be temporarily interrupted due to:</p>
      <ul className="list-disc ps-6 space-y-1">
        <li>Maintenance.</li>
        <li>Updates.</li>
        <li>Force majeure circumstances.</li>
      </ul>
      <p>This does not entitle the user to any refund or compensation.</p>
      <p>The Academy reserves the right to modify service content and update delivery mechanisms without affecting subscription validity.</p>

      <h2 className="text-xl font-bold text-gray-900">7. Financial Liability Limits</h2>
      <ul className="list-disc ps-6 space-y-1">
        <li>The maximum financial liability of the Academy, if any, shall not exceed the value of the subscription paid.</li>
        <li>The Academy bears no responsibility for trading losses, user decisions, or failures of external platforms or brokers.</li>
      </ul>

      <h2 className="text-xl font-bold text-gray-900">8. Acknowledgment & Consent</h2>
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
        <p className="font-semibold">By completing the subscription process, the user acknowledges:</p>
        <ul className="list-disc ps-6 space-y-1 mt-2">
          <li>Having read the subscription and refund policy in full.</li>
          <li>Understanding its content and legal implications.</li>
          <li>Agreeing to it without any reservation.</li>
        </ul>
      </div>

      <h2 className="text-xl font-bold text-gray-900">9. Governing Law</h2>
      <ul className="list-disc ps-6 space-y-1">
        <li>This policy is governed and interpreted in accordance with the applicable laws of Palestine.</li>
        <li>Any dispute shall be resolved amicably; failing that, the competent Palestinian courts shall be the legal reference.</li>
      </ul>

      <div className="mt-8 p-4 bg-gray-50 rounded-lg border">
        <p className="text-gray-600">To view the general Terms and Conditions:</p>
        <Link href="/terms">
          <span className="text-emerald-600 hover:underline cursor-pointer font-medium">Terms & Conditions →</span>
        </Link>
      </div>
    </>
  );
}
