import React, { useEffect } from 'react';

const Marketing = () => {
  useEffect(() => {
    document.title = 'Social Media Marketing | Karen Zhu';
  }, []);

  return (
    <main className="marketing-page">
      <h1>Social Media Marketing</h1>
      <section className="leadership-roles">
        <h2>Leadership Roles</h2>
        <p>Through my student leadership roles, I created promotional graphics and reels to promote events and increase engagement.</p>
        <div className="role-card">
          <img
            src="/img/RCFG-headers.avif"
            alt="Director of Creative Content - Rotman Commerce Fashion Group"
            className="role-card-image"
          />
          <h3>Director of Creative Content<br/>Rotman Commerce Fashion Group (2024 - 25)</h3>
        </div>
        <div className="role-card">
          <img
            src="/img/FLC-headers.avif"
            alt="Director of Marketing & Design - UofT Finance & Leadership Council"
            className="role-card-image"
          />
          <h3>Director of Marketing & Design<br/>UofT Finance & Leadership Council (2025 - 26)</h3>
        </div>
      </section>
    </main>
  );
};

export default Marketing;
