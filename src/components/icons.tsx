import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement>;
const Icon = ({ children, ...props }: Props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    {children}
  </svg>
);

export const LogoIcon = (p: Props) => <Icon {...p}><path d="m4 17 5-5 4 4 7-8"/><path d="M14 8h6v6"/></Icon>;
export const TodayIcon = (p: Props) => <Icon {...p}><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="m8 15 2 2 5-5"/></Icon>;
export const ProblemsIcon = (p: Props) => <Icon {...p}><path d="M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M8 8h8M8 12h5M8 16h3"/></Icon>;
export const PlansIcon = (p: Props) => <Icon {...p}><path d="M7 4h13v16H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z"/><path d="M7 4v16M11 9h5M11 13h5"/></Icon>;
export const AnalyticsIcon = (p: Props) => <Icon {...p}><path d="M4 19V9m5 10V5m6 14v-7m5 7V3"/></Icon>;
export const SettingsIcon = (p: Props) => <Icon {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></Icon>;
export const FlameIcon = (p: Props) => <Icon {...p}><path d="M12 22c4.4 0 7-3.2 7-7.1 0-3.1-1.8-6-4.6-8.6.2 2.1-.7 3.7-2.1 4.5.2-3.7-2-6.8-5-8.8.3 3.6-2.3 5.9-2.3 9.9C5 17.6 7.8 22 12 22Z"/><path d="M9.5 17.5c0-1.8 1.1-3 2.5-4.2 1.4 1.2 2.5 2.4 2.5 4.2a2.5 2.5 0 0 1-5 0Z"/></Icon>;
export const BellIcon = (p: Props) => <Icon {...p}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></Icon>;
export const ChevronIcon = (p: Props) => <Icon {...p}><path d="m9 18 6-6-6-6"/></Icon>;
export const ArrowIcon = (p: Props) => <Icon {...p}><path d="M5 12h14m-6-6 6 6-6 6"/></Icon>;
export const CheckIcon = (p: Props) => <Icon {...p}><path d="m5 12 4 4L19 6"/></Icon>;
export const SparkIcon = (p: Props) => <Icon {...p}><path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3Z"/><path d="m18.5 14 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z"/></Icon>;
export const LogoutIcon = (p: Props) => <Icon {...p}><path d="M10 17l5-5-5-5M15 12H3"/><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/></Icon>;
export const ClockIcon = (p: Props) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></Icon>;
