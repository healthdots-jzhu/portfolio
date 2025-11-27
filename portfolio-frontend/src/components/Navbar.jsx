import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './Navbar.css';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen((prev) => !prev);
  const closeMenu = () => setIsOpen(false);

  return (
    <nav className="navbar">
      <div className="navbar-logo">Karen Zhu</div>
      <button
        className={`hamburger ${isOpen ? 'open' : ''}`}
        onClick={toggleMenu}
        aria-label="Toggle navigation menu"
      >
        <span />
        <span />
        <span />
      </button>
      <ul className={`navbar-links ${isOpen ? 'show' : ''}`}>
        <li><Link to="/" onClick={closeMenu}>About Me</Link></li>
        <li><Link to="/rcfg" onClick={closeMenu}>RCFG</Link></li>
        <li><Link to="/marketing" onClick={closeMenu}>Marketing</Link></li>
      </ul>
    </nav>
  );
};

export default Navbar;
