"use client"
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface LogoProps {
  className?: string;
  _showText?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export const Logo = ({ className, _showText = true, size = 'md' }: LogoProps) => {
  const sizeClasses = {
    xs: 'h-[40px]',
    sm: 'h-[80px]',
    md: 'h-[100px]',
    lg: 'h-[200px]',
  };
  return (
    <div className={cn('flex items-center', className)}>
      <Image
        src="/assets/Rapid.png"
        alt="Rapid Wash"
        className={cn(sizeClasses[size], 'w-auto')}
        height={size === 'xs' ? 20 : size === 'sm' ? 40 : size === 'md' ? 56 : 80}
        width={size === 'xs' ? 120 : size === 'sm' ? 150 : size === 'md' ? 250 : 280}
      />
    </div>
  );
};
