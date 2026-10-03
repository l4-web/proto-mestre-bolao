import{c as n,j as e,ba as f,b as x}from"./index-jhv5ocys.js";import{a as p}from"./react-C60AVq05.js";/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const k=n("Calendar",[["path",{d:"M8 2v4",key:"1cmpym"}],["path",{d:"M16 2v4",key:"4m81vk"}],["rect",{width:"18",height:"18",x:"3",y:"4",rx:"2",key:"1hopcy"}],["path",{d:"M3 10h18",key:"8toen8"}]]);/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const v=n("Plus",[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"M12 5v14",key:"s699le"}]]);/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const j=n("Send",[["path",{d:"M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z",key:"1ffxy3"}],["path",{d:"m21.854 2.147-10.94 10.939",key:"12cjpa"}]]),y=p.forwardRef(({className:u,label:o,error:t,helper:a,required:c,id:h,...s},m)=>{const b=p.useId(),r=h??b,d=`${r}-message`,l=!!t,i=s.type==="date"||s.type==="month";return e.jsxs("div",{className:"flex w-full flex-col gap-1.5",children:[o&&e.jsxs(f,{htmlFor:r,className:"text-[12px] font-semibold tracking-[-0.01em] text-text-secondary",children:[o,c&&e.jsx("span",{className:"ml-1 text-text-muted","aria-hidden":!0,children:"*"})]}),e.jsxs("div",{className:x("relative w-full",i&&"flex items-center"),children:[e.jsx("input",{ref:m,id:r,required:c,"aria-invalid":l||void 0,"aria-describedby":t||a?d:void 0,className:x("h-[38px] w-full rounded-[10px] border-[0.5px] border-[var(--l4-surface-borda)] bg-surface px-3 py-0","text-[15px] text-text-strong placeholder:text-text-muted","transition-colors duration-base ease-default","shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] transition-[box-shadow,border-color] duration-fast ease-default","focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/25","disabled:cursor-not-allowed disabled:opacity-60",l&&"border-error-accent",i&&["pr-9 [&::-webkit-datetime-edit]:text-text-strong","[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0","[&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full","[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"],u),...s}),i&&e.jsx(k,{className:"pointer-events-none absolute right-3 h-4 w-4 text-text-muted","aria-hidden":!0})]}),t&&e.jsx("p",{id:d,className:"text-[12px] text-error-text",children:t}),!t&&a&&e.jsx("p",{id:d,className:"text-[12px] text-text-secondary",children:a})]})});y.displayName="Input";export{y as I,v as P,j as S};
