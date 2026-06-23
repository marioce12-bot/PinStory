import Image from "next/image";
import Link from "next/link";

export function BrandLogo({ href = "/en" }: { href?: string }) {
  return (
    <Link href={href} className="brand-mark">
      <Image className="brand-logo" src="/images/pinstory-logo.jpeg" alt="PinStory logo" width={44} height={44} priority />
      <span>PinStory</span>
    </Link>
  );
}
