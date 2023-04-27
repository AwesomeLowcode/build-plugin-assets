import {
  plugins,
  setters
} from '@alilc/lowcode-engine';

import { name, version } from '../package.json';

{{{pluginImportStr}}}
{{{setterImportStr}}}

const registerCustomExt = async () => {

{{{registerPluginStr}}}
{{{registerSetterStr}}}

  console.log('完成插件/设置器 ' + name + ' 注册');
}

export { registerCustomExt };

const library = '{{{ library }}}';
const execCompile = !!{{{ execCompile }}};

if (!execCompile) {
  window[library] = { registerCustomExt };
}

console.log(
  '%c ' + name + ' %c v' + version,
  'padding: 2px 1px; border-radius: 3px 0 0 3px; color: #fff; background: #5584ff; font-weight: bold;',
  'padding: 2px 1px; border-radius: 0 3px 3px 0; color: #fff; background: #42c02e; font-weight: bold;',
);