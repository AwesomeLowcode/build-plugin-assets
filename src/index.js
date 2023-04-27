const path = require('path');
const fse = require('fs-extra');
const isWsl = require('is-wsl');
const chokidar = require('chokidar');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { getWebpackConfig } = require('build-scripts-config');

let INIT_STATE = false;
let PARSED_NPM_NAME;
const { debug } = console;

const UTILS = require('./utils');
const CONSTANTS = require('./constants');
const { install, installModule } = require('./utils/npm.ts');
const userWebpackConfig = require('./config/user-config');
const { library } = require('webpack');

const {
  parseProps,
  parseNpmName,
  generateEntry,
  asyncDebounce,
  camel2KebabComponentName,
  kebab2CamelComponentName,
  getBuiltInPackages,
  deduplicationAssets,
  getHttpResource,
  mergeAssets,
} = UTILS;

const { UNPKG_BASE_URL, COMMON_EXTERNALS } = CONSTANTS;

// async function updateDeps({rootDir, npmClient, npmOptions}) {
//   const context = {
//     workDir: rootDir,
//     npmClient,
//     npmOptions,
//   };
//   await update(context);
// }


module.exports = async (options, pluginOptions = {}) => {
  const { registerUserConfig, registerCliOption, onGetWebpackConfig, getAllTask, registerTask, onHook } = options;
  const { rootDir, command, commandArgs } = options.context;
  const { https } = commandArgs;
  const {
    externals = {},
    buildTarget = 'build',
    lowcodeDir = 'lowcode',
    npmClient = 'npm',
    npmOptions,
    baseUrl,
    unpkgBaseUrl,
  } = pluginOptions || {};
  if (!CONSTANTS.SUPPORTED_COMMAND.includes(command)) {
    debug('Command %s not supported.', command);
    return;
  }
  const cliOptions = ['watch', 'skip-demo', 'watch-dist', 'https', 'disable-open'];
  registerCliOption(
    cliOptions.map((name) => ({
      name,
      commands: ['start', 'build'],
    })),
  );
  await registerUserConfig(userWebpackConfig);

  const mode = command === 'start' ? 'development' : 'production';
  process.argv.forEach((val, index) => {
    debug(`${index}: ${val}`);
  });

  const { manifestPath = 'manifest.json' } = pluginOptions;
  const manifest = fse.readJSONSync(path.resolve(rootDir, manifestPath));

  const { name, version, plugins, setters, components, baseComponent } = manifest;

  const pkgJson = fse.readJSONSync(path.resolve(rootDir, 'package.json'));
  if (!pkgJson.dependencies) {
    pkgJson.dependencies = {};
  }
  pkgJson.name = name;
  pkgJson.version = version;
  const newPackages = [];
  if (plugins && plugins.length) {
    plugins.map(async item => {
      if (!item.npm) return;
      newPackages.push(`${item.npm}@${item.version}`)
      pkgJson.dependencies[item.npm] = item.version || '*';
    })
  }
  if (setters && setters.length) {
    setters.map(async item => {
      if (!item.npm) return;
      newPackages.push(`${item.npm}@${item.version}`)
      pkgJson.dependencies[item.npm] = item.version || '*';
    })
  }
  fse.writeFileSync(path.resolve(rootDir, 'package.json'), JSON.stringify(pkgJson, null, 2))

  if (newPackages.length) {
    // await installModule({
    //   workDir: rootDir,
    //   npmClient,
    //   npmOptions,
    // },newPackages.join(' '))
    await install({
      workDir: rootDir,
      npmClient,
      npmOptions,
    })
  }

  const npm = name;
  const customExtInfo = parseNpmName(npm);
  const extLibrary = customExtInfo.uniqueName;
  const _baseUrl = baseUrl || `${unpkgBaseUrl || UNPKG_BASE_URL}/${npm}@${version}`;
  const extUrls = mode === 'production' ? [
    `${_baseUrl}/build/lowcode/ext.js`,
    `${_baseUrl}/build/lowcode/ext.css`,
  ] : [
    '/ext.js',
    '/ext.css',
  ];

  const pluginList = [];
  const setterList = [];

  const pluginImportStr = plugins.map(({ npm: plugin, options = {} }) => {
    const parsedData = parseNpmName(plugin);
    const name = parsedData.uniqueName;
    pluginList.push({
      name,
      options: JSON.stringify(options),
    });
    return `import ${name} from '${plugin}';\n`;
  }).join('');

  const setterImportStr = setters.map(({ npm: setter, name }) => {
    setterList.push(name);
    return `import ${name} from '${setter}';\n`;
  }).join('');

  const registerPluginStr = pluginList.map(({ name: plugin, options }) => {
    return `  plugins.register(${plugin}, ${options});\n`;
  }).join('');

  const registerSetterStr = setterList.map(setter => {
    return `  setters.registerSetter('${setter}', ${setter});\n`;
  }).join('');

  const extJsParams = {
    pluginImportStr,
    setterImportStr,
    registerPluginStr,
    registerSetterStr,
    library: extLibrary,
    execCompile: mode === 'production',
  };

  const extJs = generateEntry({
    template: 'ext.jsx',
    filename: 'ext.jsx',
    rootDir,
    params: extJsParams,
  });

  // assets.json

  const assetsJson = {
    packages: [],
    components: [],
    extConfig: {
      customExt: {
        library: extLibrary,
        urls: extUrls,
      },
    },
  };

  // 1. 获取组件需要内置的依赖数据
  const builtinPackages = getBuiltInPackages(baseComponent);

  if (builtinPackages && builtinPackages.length) {
    assetsJson.packages = builtinPackages.concat(assetsJson.packages);
  }

  // 2. 获取组件自身资产包数据
  // assetsUrl: 'https://unpkg.com/@alilc/lowcode-materials@1.1.0/build/lowcode/assets-prod.json',
  await Promise.all(
    components.map(async component => {
      const componentAssets = await getHttpResource(`https://github.elemecdn.com/${component.npm}@${component.version}/build/lowcode/assets-prod.json`, 'json');
      if (componentAssets) {
        mergeAssets(assetsJson, componentAssets);
      }
    })
  );

  if (mode === 'production') {
    if (getAllTask().includes('lowcode-assets-build')) return;
    registerTask('lowcode-assets-build', getWebpackConfig('production'));
    onGetWebpackConfig('lowcode-assets-build', (config) => {
      const entry = {
        ext: extJs
      }
      config.merge({
        entry,
      });
      config.output.library(extLibrary).libraryTarget('umd');
      config.output.path(path.resolve(rootDir, `${buildTarget}/${lowcodeDir}`));
      config.externals({ ...COMMON_EXTERNALS, ...externals });
    });
    onHook('after.build.compile', () => {
      const duplicatedAssets = deduplicationAssets(assetsJson);
      fse.writeFileSync(path.resolve(rootDir, `${buildTarget}/${lowcodeDir}/assets.json`), JSON.stringify(duplicatedAssets, null, 2))
    });
  } else {
    start(extJs, assetsJson, https, externals, getAllTask, onGetWebpackConfig, registerTask);
    const watchPattern = path.resolve(rootDir, '**.json');
    const watcher = chokidar.watch(watchPattern);
    ['add', 'change', 'unlink'].forEach((item) => {
      watcher.on(item, async () => {
        await debounceStart(extJs, assetsJson, https, externals, getAllTask, onGetWebpackConfig, registerTask);
      });
    });
  }
};

const start = (extJs, assetsJson, https, externals, getAllTask, onGetWebpackConfig, registerTask) => {
  if (getAllTask().includes('lowcode-assets-dev')) return;
  registerTask('lowcode-assets-dev', getWebpackConfig('development'));
  onGetWebpackConfig('lowcode-assets-dev', (config) => {
    const entry = {
      ext: extJs
    }
    config.merge({
      entry,
    });
    config.plugin('index').use(HtmlWebpackPlugin, [
      {
        template: require.resolve('./public/index.html'),
        filename: 'index.html',
        templateParameters: {
          assets: JSON.stringify(assetsJson, null, 2),
        }
      },
    ]);
    config.devServer.headers({ 'Access-Control-Allow-Origin': '*' });

    config.devServer.https(Boolean(https));
    config.devServer.set('transportMode', 'ws');
    // WSL 环境下正常的文件 watch 失效，需切换为 poll 模式
    if (isWsl) {
      config.merge({
        devServer: {
          watchOptions: {
            poll: 1000,
          },
        },
      });
    }
    config.externals({ ...COMMON_EXTERNALS, ...externals });
  })
}

const debounceStart = asyncDebounce(start, 300);