import React, { useEffect } from 'react';

const Home = () => {
  useEffect(() => {
    document.title = 'About Me | Karen Zhu';
  }, []);

  return (
    <main className="home-page">
      <div className="home-avatar-wrapper">
        <img 
          src="/img/Personal-Character.avif" 
          alt="Personal-Character.avif"
          className="home-avatar"
        />
      </div>
      <h1>Karen Zhu</h1>
      <h2>About Me</h2>
      <p>I'm a business student with a strong passion for design. Growing up taking art classes, I always enjoyed expressing my creativity in visual forms and found that I had a talent for it.<br/><br/>
      I decided to pursue business as a degree because of the flexibility of being able to mould my interests with work and school. Like art, business requires thoughtful solutions that are both creative and practical. In my first year of classes at the University of Toronto, I particularly enjoyed my marketing classes because they heavily involved a creative components and offer opportunities to expand into design.<br/><br/>
      To further explore this area of interest, in July of 2024, I completed the Google UX Design course and learned how to develop wireframes and mockups on Figma. Furthermore, I placed in the final of the 2024 Design Dash competition hosted by Rotman Commerce by applying these skills. This experience revealed a strong interest to continue pursuing creative opportunities as I not only enjoyed them, but had a talent for it.<br/><br/>
      I strive to use design and business strategy to create innovative and accessible user experiences. Please reach out to learn a bit more about me!</p>
      <section className="fun-facts">
        <h3>Some Fun Facts</h3>
        <ul>
          <li>I enjoy making different cafe style drinks! My favourites: matcha lattes, lavender london fogs, Hong Kong style milk tea, yuzu tea. I like visiting local cafes and rating their drinks for inspiration.</li>
          <li>I have a passion for fashion - it's another creative form of expression and I believe in dressing for success. I also admire creative marketing in the fashion industry.</li>
        </ul>
      </section>
    </main>
  );
};

export default Home;
