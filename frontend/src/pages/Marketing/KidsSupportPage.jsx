import { Link } from "react-router-dom";

const KidsSupportPage = () => (
  <main className="kids-marketing-page">
    <section className="kids-marketing-hero kids-marketing-hero--compact">
      <p className="kids-marketing-eyebrow">Everday Kids</p>
      <h1>Support</h1>
      <p className="kids-marketing-lede">
        Need help with login, chores, balances, or family account setup. Reach us directly and we
        will help you sort it out.
      </p>
      <div className="kids-marketing-actions">
        <a className="primary-button" href="mailto:support@everday.app">
          Email support
        </a>
        <Link className="button-secondary" to="/kids-app">
          Back to product page
        </Link>
      </div>
    </section>

    <section className="kids-marketing-section" aria-labelledby="support-contact-title">
      <h2 id="support-contact-title">Contact</h2>
      <div className="kids-marketing-card">
        <p>
          Email:
          <a href="mailto:support@everday.app"> support@everday.app</a>
        </p>
        <p>Response time: usually within 2 business days.</p>
      </div>
    </section>

    <section className="kids-marketing-section" aria-labelledby="support-common-title">
      <h2 id="support-common-title">Common help topics</h2>
      <div className="kids-marketing-card">
        <ul className="kids-marketing-list">
          <li>Cannot sign in or reset password.</li>
          <li>Kid account access or role setup issues.</li>
          <li>Chore history or balance display questions.</li>
        </ul>
      </div>
    </section>

    <section className="kids-marketing-section" aria-labelledby="support-links-title">
      <h2 id="support-links-title">Useful links</h2>
      <div className="kids-marketing-links kids-marketing-links--stacked">
        <Link to="/kids-app/privacy">Privacy policy</Link>
        <Link to="/kids-app">Product page</Link>
      </div>
    </section>
  </main>
);

export default KidsSupportPage;
