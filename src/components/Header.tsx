import Image from "next/image";
import Link from "next/link";

export function Header() {
  return (
    <header className="w-full border-b border-white/10 bg-asphalt">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3" aria-label="Garagem">
          <Image
            src="/logo.png"
            alt="Garagem"
            width={140}
            height={40}
            priority
            className="h-9 w-auto"
          />
        </Link>
        <div
          className="h-0.5 w-16 bg-brand-gradient sm:w-24"
          aria-hidden="true"
        />
      </div>
    </header>
  );
}
