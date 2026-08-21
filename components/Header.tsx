"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";

const links = [
  ["Home", "/"], ["Events", "/events"], ["Services", "/services"],
  ["Gallery", "/gallery"], ["About", "/about"], ["Contact", "/contact"],
];

export function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const updateHeader = () => setScrolled(window.scrollY > 24);
    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
    return () => window.removeEventListener("scroll", updateHeader);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("mobile-menu-open", open);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    if (open) window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.classList.remove("mobile-menu-open");
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <header className={`site-header ${scrolled ? "is-scrolled" : ""}`}>
      <Logo />
      <nav className="desktop-nav" aria-label="Primary navigation">
        {links.map(([label, href]) => (
          <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>{label}</Link>
        ))}
      </nav>
      <Link className="button button-small header-quote" href="/contact">Get a quote</Link>
      <button className="menu-button" type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? "Close menu" : "Open menu"}>
        {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
      </button>
      <div id="mobile-menu" className={`mobile-menu ${open ? "is-open" : ""}`} aria-hidden={!open}>
        <nav aria-label="Mobile navigation">
          {links.map(([label, href], index) => <Link key={href} href={href} onClick={() => setOpen(false)}><span>0{index + 1}</span>{label}</Link>)}
        </nav>
        <Link className="button" href="/contact" onClick={() => setOpen(false)}>Get a quote</Link>
        <p>Niagara, Ontario · Canada</p>
      </div>
    </header>
  );
}
