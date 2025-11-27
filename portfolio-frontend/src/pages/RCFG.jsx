import React, { useEffect } from 'react';

const thriftFindsImages = [
  { src: '/img/ExecThriftFinds.avif', alt: 'Exec Thrift Finds Cover' },
  { src: '/img/Exec Thrift Finds (1).avif', alt: 'Exec Thrift Finds 1' },
  { src: '/img/Exec Thrift Finds (2).avif', alt: 'Exec Thrift Finds 2' },
  { src: '/img/Exec Thrift Finds (3).avif', alt: 'Exec Thrift Finds 3' },
  { src: '/img/Exec Thrift Finds (4).avif', alt: 'Exec Thrift Finds 4' },
  { src: '/img/Exec Thrift Finds (5).avif', alt: 'Exec Thrift Finds 5' },
  { src: '/img/Exec Thrift Finds (6).avif', alt: 'Exec Thrift Finds 6' },
  { src: '/img/Exec Thrift Finds (7).avif', alt: 'Exec Thrift Finds 7' },
];

const RCFG = () => {
  useEffect(() => {
    document.title = 'RCFG | Karen Zhu';
  }, []);

  return (
  <main className="rcfg-page">
    <h1>Rotman Commerce Fashion Group (RCFG)</h1>
    <section className="about">
      <h2>About</h2>
      <p>
        A fashion business club run by University of Toronto students that revolves around core values of education, community, and networking in the fashion industry. The purpose of RCFG is to provide Rotman Commerce students the opportunity to connect on fashion and beauty topics such as global trends, styling advice, fashion careers, and business fashion.
      </p>
    </section>
    <section className="my-journey">
      <h2>My Journey</h2>
      <p>Director of Creative Content Feb 2024 - Present<br/>Manager of Creative Content Feb 2023 - Feb 2024</p>
    </section>
    <section className="impact">
      <h2>Impact</h2>
      <ul>
        <li>450+ student event attendees</li>
        <li>10,000+ engaged audiences</li>
        <li>1,140 Instagram Followers</li>
      </ul>
    </section>
    <section className="merch-design">
      <h2>Merch Design</h2>
      <p>The Creative Content team was responsible for designing merch for this year's team. Below are some rough ideas and iterations upon receiving feedback:</p>
      <div className="merch-grid">
        <img src="/img/karen-1-1.avif" alt="karen - 1 (1).png" className="merch-card" />
        <img src="/img/karen-2-1.avif" alt="karen - 2 (1).png" className="merch-card" />
        <img src="/img/Untitled50_20240716182107.avif" alt="Untitled50_20240716182107.png" className="merch-card" />
      </div>
    </section>
    <section className="creative-posts">
      <h2>Creative Posts</h2>
      <p>Our team thinks of creative ways to promote club events and, when there are no upcoming events, executes large creative projects such as street interviews and Instagram takeovers to keep our audience entertained and maintain consistent uploads.</p>
      <h3>RCFG Thrift Finds</h3>
      <p>This September, to promote our Thrifting in Toronto event, we created a scrapbook style post to showcase executive team thrift finds.<br />759 Accounts Reached · 85.7% from followers · 14.3% from non-followers.</p>
      <div className="thrift-gallery">
        {thriftFindsImages.map((image) => (
          <img
            key={image.src}
            src={image.src}
            alt={image.alt}
            className="thrift-card"
          />
        ))}
      </div>
    </section>
    <section className="leadership">
      <h2>Director of Creative Content (Feb. 2024 - Present)</h2>
      <ul>
        <li>Directed a group of 5 committee members to increase engagement and maximize event attendance.</li>
        <li>Worked closely with Marketing Directors to organize a content calendar and upload schedule.</li>
        <li>Encouraged idea generation and delegated tasks to committee members based on their strengths.</li>
        <li>Kept up with Instagram/TikTok trends and executed creative fashion content posts.</li>
      </ul>
    </section>
    <section className="creative-reels">
      <h2>Creative Reels</h2>
      <p>Event Recaps, Day in the Life, and more coming soon...</p>
    </section>
    <section className="connect connect-section">
      <h2>Connect with Us</h2>
      <p>Instagram: <a href="https://www.instagram.com/rcfashiongroup" target="_blank" rel="noopener noreferrer">@rcfashiongroup</a></p>
      <p><a href="https://www.rcfashiongroup.com" target="_blank" rel="noopener noreferrer">www.rcfashiongroup.com</a></p>
    </section>
  </main>
  );
};

export default RCFG;
