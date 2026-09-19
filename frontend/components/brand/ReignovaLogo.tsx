import React from 'react';
import { cn } from '@/lib/utils';

export interface ReignovaIconProps {
  className?: string;
  size?: number;
}

export function ReignovaIcon({
  className = '',
  size = 32,
}: ReignovaIconProps) {
  return (
    <svg
      viewBox="0 0 800 800"
      width={size}
      height={size}
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Reignova Technologies Logo"
    >
      {/* Deep Navy rounded container matching Reignova parent company icon */}
      <rect width="800" height="800" rx="160" fill="#0F1A25" />
      {/* Official Reignova Gold Stylized R with network circuit node */}
      <path
        fill="#F3A221"
        d="M557.65,467.39c0,0,96.21-30.27,96.21-157c0-85.57-76-169.75-169.75-169.75H198.84c-45.26,0-81.96,36.69-81.96,81.96v311.33c-24.08,12.71-39.45,39.73-34.68,69.76c4.6,29.02,28.79,51.96,57.99,55.24c40.21,4.52,74.27-26.83,74.27-66.13c0-25.75-14.65-48.04-36.05-59.11V232.88c0-14.49,11.75-26.24,26.24-26.24h267.34c17.24,0,34.49,3.1,50.1,10.41c61.98,29.03,75.14,101.36,50.1,156.27c-29.09,63.77-129.77,57.05-129.77,57.05l145.43,163.33h-89.5L317.13,396.82v-51.46l153.57,0c16.65,0,31.52-12.17,33.1-28.75c1.81-19.02-13.09-35.02-31.73-35.02H257.84v135.36l213.89,233.11h246.94L557.65,467.39z M147.89,616.38c-13.02,0-23.58-10.56-23.58-23.58c0-13.02,10.56-23.58,23.58-23.58c13.02,0,23.58,10.56,23.58,23.58C171.47,605.82,160.92,616.38,147.89,616.38z"
      />
    </svg>
  );
}

export interface ReignovaLogoProps {
  className?: string;
  containerClassName?: string;
  size?: number;
  showText?: boolean;
  title?: React.ReactNode;
  textClassName?: string;
  subtitle?: string;
}

export function ReignovaLogo({
  className = 'h-8 w-auto',
  containerClassName,
  size = 32,
  showText = true,
  title,
  textClassName = 'text-slate-900',
  subtitle,
}: ReignovaLogoProps) {
  if (!showText) {
    return <ReignovaIcon size={size} className={className} />;
  }

  return (
    <div className={cn("flex items-center gap-2.5", containerClassName)}>
      <ReignovaIcon size={size} className={className} />
      <div className="flex flex-col">
        {title ? (
          typeof title === 'string' ? (
            <span className={cn("font-bold tracking-tight text-sm leading-tight", textClassName)}>
              {title}
            </span>
          ) : (
            title
          )
        ) : (
          <span className={cn("font-bold tracking-tight text-base sm:text-lg leading-tight", textClassName)}>
            Reignova <span className="text-[#F3A221]">Pay</span>
          </span>
        )}
        {subtitle && (
          <span className="text-[11px] font-medium text-slate-500 leading-tight">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
