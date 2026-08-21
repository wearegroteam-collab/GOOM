"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "./Logo";

const links = [
  ["Home", "/"], ["Events", "/events"], ["Services", "/services"],
  ["Gallery", "/gallery"], ["About", "/about"], ["Contact", "/contact"],
];

export function Header() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="site-header">
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
