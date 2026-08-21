import Image from "next/image";
import Link from "next/link";

export function Logo() {
  return (
    <Link className="brand" href="/" aria-label="GOOM Event Production home">
      <Image
        className="brand-image"
        src="/images/goom-logo.png"
        alt="GOOM Event Production"
        width={1024}
        height={1024}
        sizes="(max-width: 767px) 126px, 148px"
        loading="eager"
      />
    </Link>
  );
}
