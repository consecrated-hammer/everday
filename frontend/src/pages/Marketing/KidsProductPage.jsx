import { Link } from "react-router-dom";

const features = [
  {
    title: "Daily jobs and habits",
    description:
      "Kids can tick off daily jobs, build habits, and see progress in one simple home screen."
  },
  {
    title: "Bonus task rewards",
    description:
      "Parents can assign bonus tasks so kids can earn extra money for effort and responsibility."
  },
  {
    title: "Clear money tracking",
    description:
      "Kids can view available balance, monthly totals, and projected growth with easy-to-read charts."
  },
  {
    title: "History and transparency",
    description:
      "Every completed task and money movement can be reviewed in history for trust and accountability."
  }
];

const KidsProductPage = () => (
  <main className="kids-marketing-page">
    <section className="kids-marketing-hero">
      <p className="kids-marketing-eyebrow">Everday</p>
      <h1>Everday Kids</h1>
      <p className="kids-marketing-lede">
        A simple kids experience for chores, habits, and pocket money tracking. Built for families
        who want clear routines and visible progress.
      </p>
      <div className="kids-marketing-actions">
        <Link className="primary-button" to="/kids-app/support">
          Support
        </Link>
        <Link className="button-secondary" to="/kids-app/privacy">
          Privacy policy
        </Link>
      </div>
    </section>

    <section className="kids-marketing-section" aria-labelledby="kids-features-title">
      <h2 id="kids-features-title">Kids functionality</h2>
      <div className="kids-marketing-grid">
        {features.map((item) => (
          <article key={item.title} className="kids-marketing-card">
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </article>
        ))}
      </div>
    </section>

    <section className="kids-marketing-section" aria-labelledby="kids-submission-title">
      <h2 id="kids-submission-title">App submission essentials</h2>
      <div className="kids-marketing-card">
        <ul className="kids-marketing-list">
          <li>Privacy policy: available at the link below.</li>
          <li>Support: direct contact and quick help options are listed below.</li>
          <li>Audience: designed for family use with parent-managed setup.</li>
        </ul>
        <div className="kids-marketing-links">
          <Link to="/kids-app/privacy">View privacy policy</Link>
          <Link to="/kids-app/support">View support</Link>
        </div>
      </div>
    </section>
  </main>
);

export default KidsProductPage;
