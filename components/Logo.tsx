import Link from "next/link";

export function Logo() {
  return (
    <Link className="brand" href="/" aria-label="GOOM Event Production home">
      GOOM<span>EVENT PRODUCTION</span>
    </Link>
  );
}
