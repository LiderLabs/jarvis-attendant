"use client"

import { cn } from '@/lib/utils';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Logo = ({ className, size = 'md' }: LogoProps) => {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null; // 🔥 prevents hydration issues in prod

  const sizeConfig = {
    sm: { height: 28, width: 100 },
    md: { height: 40, width: 160 },
    lg: { height: 80, width: 280 },
  };

  const { height, width } = sizeConfig[size];

  const logoSrc =
    resolvedTheme === 'dark'
      ? '/assets/javis.png'
      : '/assets/javis.png';

  return (
    <div className={cn('flex items-center items-center', className)} >
      <Image
        src={logoSrc}
        alt="Javis - Life made simple"
        height={height}
        width={width}
        className="w-auto" 
        priority
      />
    </div>
  );
};





