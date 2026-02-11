import { Link } from "react-router-dom";

const KidsPrivacyPage = () => (
  <main className="kids-marketing-page">
    <section className="kids-marketing-hero kids-marketing-hero--compact">
      <p className="kids-marketing-eyebrow">Everday Kids</p>
      <h1>Privacy Policy</h1>
      <p className="kids-marketing-lede">
        We keep data collection limited to what is needed for kids chores, history, and pocket money
        tracking.
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

    <section className="kids-marketing-section" aria-labelledby="privacy-summary-title">
      <h2 id="privacy-summary-title">What we collect</h2>
      <div className="kids-marketing-card">
        <ul className="kids-marketing-list">
          <li>Account details needed for login and household setup.</li>
          <li>Kids chore entries, approval history, and money ledger events.</li>
          <li>Basic technical logs required for security and reliability.</li>
        </ul>
      </div>
    </section>

    <section className="kids-marketing-section" aria-labelledby="privacy-usage-title">
      <h2 id="privacy-usage-title">How data is used</h2>
      <div className="kids-marketing-card">
        <ul className="kids-marketing-list">
          <li>To run core kids features like jobs, habits, and balance history.</li>
          <li>To protect accounts and troubleshoot issues.</li>
          <li>No selling of personal data and no third-party advertising in kids views.</li>
        </ul>
      </div>
    </section>

    <section className="kids-marketing-section" aria-labelledby="privacy-rights-title">
      <h2 id="privacy-rights-title">Your controls</h2>
      <div className="kids-marketing-card">
        <p>
          Parents can request updates or deletion for household data through support. Contact:
          <a href="mailto:everdayfamily.support@gmail.com"> everdayfamily.support@gmail.com</a>.
        </p>
        <p className="kids-marketing-muted">Last updated: February 11, 2026.</p>
      </div>
    </section>
  </main>
);

export default KidsPrivacyPage;
