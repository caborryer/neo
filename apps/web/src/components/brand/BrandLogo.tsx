import { cn } from '@/utils/cn';

/** Logotipo neoTRAINING (Manual de imagen). Respetar el área de protección y no deformarlo (docs/MARCA.md). */
export function BrandLogo({ className }: { className?: string }) {
  return <img src="/logo.svg" alt="neoTRAINING" className={cn('h-10 w-auto', className)} />;
}
