import{c}from"./index-jhv5ocys.js";import{a as s}from"./react-C60AVq05.js";/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const f=c("ChevronLeft",[["path",{d:"m15 18-6-6 6-6",key:"1wnfg3"}]]);/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const h=c("Hand",[["path",{d:"M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2",key:"1fvzgz"}],["path",{d:"M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2",key:"1kc0my"}],["path",{d:"M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8",key:"10h0bg"}],["path",{d:"M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15",key:"1s1gnw"}]]);/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const d=c("Undo2",[["path",{d:"M9 14 4 9l5-5",key:"102s5s"}],["path",{d:"M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11",key:"f3b9sd"}]]);function u(){const[e,o]=s.useState(null),[a,n]=s.useState(0);return s.useEffect(()=>{if(!e)return;const r=new ResizeObserver(([t])=>{var m,i;const x=((i=(m=t==null?void 0:t.borderBoxSize)==null?void 0:m[0])==null?void 0:i.inlineSize)??e.clientWidth;n(Math.round(x))});return r.observe(e),()=>r.disconnect()},[e]),[o,a]}const b="clamp(360px, calc(100svh - 268px), 780px)";function v(e){const[o,a]=u(),n=a>=900,t=!(a>=620);return{ref:o,largura:a,umaColunaSo:t,cabeContexto:n,mostrarLista:!t||!e.temSelecao,mostrarItem:!t||e.temSelecao,mostrarContexto:e.temSelecao&&e.temContexto&&n,colunas:t?"minmax(0,1fr)":e.temContexto&&n?"minmax(230px,258px) minmax(380px,1fr) minmax(240px,292px)":"minmax(236px,264px) minmax(0,1fr)"}}export{b as A,f as C,h as H,d as U,v as u};
