// Web Awesome components used by Planner, and the icon library that maps
// <wa-icon name="..."> to the Material Symbols SVGs bundled in public/icons/material.
import '@awesome.me/webawesome/dist/components/page/page.js';
import '@awesome.me/webawesome/dist/components/button/button.js';
import '@awesome.me/webawesome/dist/components/icon/icon.js';
import '@awesome.me/webawesome/dist/components/input/input.js';
import '@awesome.me/webawesome/dist/components/textarea/textarea.js';
import '@awesome.me/webawesome/dist/components/select/select.js';
import '@awesome.me/webawesome/dist/components/option/option.js';
import '@awesome.me/webawesome/dist/components/checkbox/checkbox.js';
import '@awesome.me/webawesome/dist/components/dialog/dialog.js';
import '@awesome.me/webawesome/dist/components/callout/callout.js';
import '@awesome.me/webawesome/dist/components/tag/tag.js';
import '@awesome.me/webawesome/dist/components/tooltip/tooltip.js';
import '@awesome.me/webawesome/dist/components/divider/divider.js';
import '@awesome.me/webawesome/dist/components/spinner/spinner.js';
import { registerIconLibrary } from '@awesome.me/webawesome/dist/webawesome.js';

registerIconLibrary('default', {
  resolver: (name: string) => `/icons/material/${name}.svg`,
  mutator: (svg: SVGElement) => svg.setAttribute('fill', 'currentColor')
});
