import type { Config } from "tailwindcss";
import {
  colors,
  spacing,
  radius,
  shadow,
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  duration,
  easing,
  z,
} from "./src/styles/ds-tokens";

/**
 * Tema Tailwind do app — derivado dos tokens do @l4-web/ui (fonte única).
 * Assim a JSX do shell (que usa `text-text-strong`, `bg-info-bg`, etc.) resolve
 * sem reescrever para inline.
 *
 * IMPORTANTE (ordem de CSS): em `main.tsx` o CSS do app (este Tailwind) é
 * importado ANTES do `@l4-web/ui/styles.css`, para a lib vencer empates de
 * utility (ex.: `md:left-1/2` do ModalContent vs `inset-x-0` do app).
 *
 * O DS NÃO precisa de Tailwind (entrega CSS pré-compilado). Usamos Tailwind só
 * para o layout/chrome do APP — os componentes continuam vindo prontos da lib.
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    // Replace (não extend): os tokens são a paleta completa do app.
    colors: {
      brand: {
        deep: colors.brandDeep,
        DEFAULT: colors.brandPrimary,
        primary: colors.brandPrimary,
        hover: colors.brandHover,
        active: colors.brandActive,
        accent: colors.brandAccent,
      },
      // `--l4-surface` e `--l4-text-strong` vêm do DS em CANAIS RGB
      // ("255 255 255"), justamente para o Tailwind poder aplicar alpha por cima.
      // As demais variáveis do DS já são cor completa, então entram diretas.
      surface: {
        DEFAULT: "rgb(var(--l4-surface) / <alpha-value>)",
        muted: "var(--l4-surface-muted)",
        soft: "var(--l4-surface-soft)",
        alt: "var(--l4-surface-alt)",
        chip: "var(--l4-surface-chip)",
      },
      border: {
        DEFAULT: "var(--l4-border)",
        soft: "var(--l4-border-soft)",
        strong: "var(--l4-border-strong)",
        muted: "var(--l4-surface-borda)",
      },
      text: {
        strong: "rgb(var(--l4-text-strong) / <alpha-value>)",
        primary: "rgb(var(--l4-text-strong) / <alpha-value>)",
        neutral: "rgb(var(--l4-text-strong) / <alpha-value>)",
        // O DS não publica secundário nem terciário; ver a nota em index.css.
        secondary: "var(--atd-text-2)",
        muted: "var(--atd-text-3)",
      },
      success: {
        text: "var(--l4-success-text)",
        bg: colors.successBg,
        border: colors.successBorder,
        accent: colors.successAccent,
      },
      warn: {
        text: "var(--l4-warn-text)",
        bg: colors.warnBg,
        border: colors.warnBorder,
        accent: colors.warnAccent,
      },
      error: {
        text: "var(--l4-error-text)",
        bg: colors.errorBg,
        border: colors.errorBorder,
        accent: colors.errorAccent,
      },
      info: {
        text: "var(--l4-info-text)",
        bg: colors.infoBg,
        border: colors.infoBorder,
        accent: colors.infoAccent,
      },
      purple: { DEFAULT: colors.purple, bg: colors.purpleBg, soft: colors.purpleSoft },
      orange: { DEFAULT: colors.orange, bg: colors.orangeBg },
      navy: {
        DEFAULT: colors.navy,
        alt: colors.navyAlt,
        blue: colors.navyBlue,
        blueBg: colors.navyBlueBg,
      },
      white: "#FFFFFF",
      black: "#000000",
      transparent: "transparent",
      current: "currentColor",
    },
    fontFamily: {
      sans: fontFamily.sans.split(", "),
      mono: fontFamily.mono.split(", "),
    },
    extend: {
      spacing,
      borderRadius: radius,
      boxShadow: shadow,
      fontSize,
      fontWeight,
      lineHeight,
      transitionDuration: duration,
      transitionTimingFunction: easing,
      zIndex: Object.fromEntries(Object.entries(z).map(([k, v]) => [k, String(v)])),
    },
  },
  plugins: [],
} satisfies Config;
