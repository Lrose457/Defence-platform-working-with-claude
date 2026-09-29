"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavigationLink({ href, label, className = "intel-nav-link" }: { href: string; label: string; className?: string }) {
  const pathname = usePathname();
  const current = href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return <Link href={href} aria-current={current ? "page" : undefined} className={`${className}${current ? " intel-nav-link-active" : ""}`}>{label}</Link>;
}
