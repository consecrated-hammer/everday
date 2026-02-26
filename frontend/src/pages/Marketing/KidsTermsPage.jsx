import { Link } from "react-router-dom";

const KidsTermsPage = () => (
  <main className="kids-marketing-page">
    <section className="kids-marketing-hero kids-marketing-hero--compact">
      <p className="kids-marketing-eyebrow">Everday Kids</p>
      <h1>Terms of Use</h1>
      <p className="kids-marketing-lede">
        These terms cover use of Everday Kids features including chores, balances, and family
        account access.
      </p>
      <div className="kids-marketing-actions">
        <Link className="button-secondary" to="/kids-app">
          Back to product page
        </Link>
        <Link className="primary-button" to="/kids-app/support">
          Contact support
        </Link>
      </div>
    </section>

    <section className="kids-marketing-section" aria-labelledby="terms-acceptance-title">
      <h2 id="terms-acceptance-title">Acceptance and accounts</h2>
      <div className="kids-marketing-card">
        <ul className="kids-marketing-list">
          <li>You are responsible for activity under your household account.</li>
          <li>Keep login details secure and notify support if account access is compromised.</li>
          <li>Do not attempt to disrupt service availability or security.</li>
        </ul>
      </div>
    </section>

    <section className="kids-marketing-section" aria-labelledby="terms-data-title">
      <h2 id="terms-data-title">Data and availability</h2>
      <div className="kids-marketing-card">
        <ul className="kids-marketing-list">
          <li>Feature behavior may change as the app is updated.</li>
          <li>We may temporarily limit access during maintenance or incident response.</li>
          <li>Data handling details are in the Privacy Policy linked below.</li>
        </ul>
      </div>
    </section>

    <section className="kids-marketing-section" aria-labelledby="terms-links-title">
      <h2 id="terms-links-title">Related links</h2>
      <div className="kids-marketing-links kids-marketing-links--stacked">
        <Link to="/kids-app/privacy">Privacy policy</Link>
        <Link to="/kids-app/support">Support</Link>
      </div>
      <p className="kids-marketing-muted">Last updated: February 26, 2026.</p>
    </section>
  </main>
);

export default KidsTermsPage;
