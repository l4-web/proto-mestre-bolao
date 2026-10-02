/**
 * Tokens do L4 Design System, VENDORIZADOS (cópia fiel de @l4-web/ui /
 * @l4/tokens) só para alimentar o `tailwind.config.ts`.
 *
 * Por que vendorizar em vez de importar do `@l4-web/ui`? O PostCSS carrega
 * o config via jiti em contexto CJS e o pacote do DS só expõe a condição `import`
 * (ESM) nos `exports` → `require.resolve` falha ("No exports main defined"). Estes
 * valores são estáveis (Apple HIG); se a lib mudar um token, sincronize aqui.
 *
 * Em RUNTIME continue usando `import { tokens } from "@l4-web/ui"`.
 */

export const colors = {
  brandDeep: "#0040DD",
  brandPrimary: "#007AFF",
  brandHover: "#0066D6",
  brandActive: "#0040DD",
  brandAccent: "#5AC8FA",
  surface: "#FFFFFF",
  surfaceMuted: "#F2F2F7",
  surfaceSoft: "#F2F2F7",
  surfaceAlt: "#FFFFFF",
  surfaceChip: "#E5E5EA",
  borderDefault: "rgba(60, 60, 67, 0.18)",
  borderSoft: "rgba(60, 60, 67, 0.10)",
  borderStrong: "rgba(60, 60, 67, 0.36)",
  borderMuted: "rgba(60, 60, 67, 0.10)",
  textStrong: "#000000",
  textPrimary: "#000000",
  textNeutral: "#000000",
  textSecondary: "rgba(60, 60, 67, 0.60)",
  textMuted: "rgba(60, 60, 67, 0.30)",
  successText: "#1A7430",
  successBg: "rgba(52,199,89,0.12)",
  successBorder: "rgba(52,199,89,0.30)",
  successAccent: "#34C759",
  warnText: "#9A4F00",
  warnBg: "rgba(255,149,0,0.14)",
  warnBorder: "rgba(255,149,0,0.30)",
  warnAccent: "#FF9500",
  errorText: "#B91C1C",
  errorBg: "rgba(255,59,48,0.10)",
  errorBorder: "rgba(255,59,48,0.30)",
  errorAccent: "#FF3B30",
  infoText: "#0040DD",
  infoBg: "rgba(0,122,255,0.10)",
  infoBorder: "rgba(0,122,255,0.25)",
  infoAccent: "#007AFF",
  purple: "#AF52DE",
  purpleBg: "rgba(175,82,222,0.10)",
  purpleSoft: "rgba(175,82,222,0.30)",
  orange: "#FF9500",
  orangeBg: "rgba(255,149,0,0.10)",
  navy: "#1C1C1E",
  navyAlt: "#2C2C2E",
  navyBlue: "#007AFF",
  navyBlueBg: "rgba(0,122,255,0.12)",
} as const;

export const spacing = {
  "0": "0px",
  "1": "4px",
  "2": "8px",
  "3": "12px",
  "4": "16px",
  "5": "20px",
  "6": "24px",
  "7": "28px",
  "8": "32px",
  "10": "40px",
  "12": "48px",
  "16": "64px",
} as const;

export const radius = {
  none: "0px",
  xxs: "8px",
  xs: "10px",
  sm: "14px",
  md: "18px",
  lg: "22px",
  xl: "28px",
  xxl: "32px",
  pill: "9999px",
} as const;

export const shadow = {
  none: "none",
  xs: "0 1px 2px rgba(0, 0, 0, 0.04)",
  sm: "0 2px 6px rgba(0, 0, 0, 0.06)",
  md: "0 6px 16px rgba(0, 0, 0, 0.08)",
  lg: "0 12px 32px rgba(0, 0, 0, 0.10)",
  xl: "0 24px 64px rgba(0, 0, 0, 0.14)",
  brand: "0 4px 14px rgba(0, 122, 255, 0.30)",
  brandHover: "0 6px 20px rgba(0, 122, 255, 0.40)",
  inset: "inset 0 0 0 1px rgba(0, 0, 0, 0.04)",
} as const;

export const fontFamily = {
  sans: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif',
  mono: '"SF Mono", "JetBrains Mono", Consolas, monospace',
} as const;

export const fontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

export const fontSize = {
  xs: "11px",
  sm: "13px",
  base: "15px",
  md: "16px",
  lg: "17px",
  xl: "20px",
  "2xl": "22px",
  "3xl": "28px",
  "4xl": "34px",
} as const;

export const lineHeight = {
  tight: "1.18",
  snug: "1.3",
  normal: "1.45",
  relaxed: "1.55",
  loose: "1.85",
} as const;

export const easing = {
  default: "cubic-bezier(0.32, 0.72, 0, 1)",
  inOut: "cubic-bezier(0.4, 0, 0.2, 1)",
  spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
} as const;

export const duration = {
  fast: "150ms",
  base: "220ms",
  slow: "320ms",
} as const;

export const z = {
  base: 0,
  raised: 1,
  sticky: 10,
  header: 50,
  dropdown: 100,
  drawer: 200,
  fab: 500,
  modalBackdrop: 1000,
  modal: 1010,
  popover: 1050,
  toast: 1100,
  tooltip: 1200,
} as const;
