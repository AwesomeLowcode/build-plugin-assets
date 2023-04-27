const _ = require('lodash');
const path = require('path');
const axios = require('axios');
const fse = require('fs-extra');
const hbs = require('handlebars');
const mergeWith = require('lodash/mergeWith');
const parseProps = require('./parse-props.ts');

const BaseBuiltinPackages = [
  {
    package: 'moment',
    version: '2.24.0',
    urls: [ 'https://g.alicdn.com/mylib/moment/2.24.0/min/moment.min.js' ],
    library: 'moment',
  },
  {
    package: 'lodash',
    library: '_',
    urls: [ 'https://g.alicdn.com/platform/c/lodash/4.6.1/lodash.min.js' ],
  },
];

const BuiltinPackagesMap = {
  '@alifd/next': [
    ...BaseBuiltinPackages,
    {
      title: 'fusion组件库',
      package: '@alifd/next',
      version: '1.25.23',
      urls: [
        'https://g.alicdn.com/code/lib/alifd__next/1.25.23/next.min.css',
        'https://g.alicdn.com/code/lib/alifd__next/1.25.23/next-with-locales.min.js',
      ],
      library: 'Next',
    },
  ],
  antd: [
    ...BaseBuiltinPackages,
    {
      package: 'iconfont-icons',
      urls: '//at.alicdn.com/t/font_2369445_ukrtsovd92r.js',
    },
    {
      package: '@ant-design/icons',
      version: '4.7.0',
      urls: [ '//g.alicdn.com/code/npm/@ali/ant-design-icons-cdn/4.5.0/index.umd.min.js' ],
      library: 'icons',
    },
    {
      package: 'antd',
      version: '4.23.0',
      urls: [
        '//g.alicdn.com/code/lib/antd/4.23.0/antd.min.js',
        '//g.alicdn.com/code/lib/antd/4.23.0/antd.min.css',
      ],
      library: 'antd',
    },
  ],
};

/**
 * @description generate js file as webpack entry
 * @param {String} template template path
 * @param {String} filename
 * @param {String} rootDir
 * @param {Object} params params for compile template content
 * @returns {String} path of entry file
 */
function generateEntry({ template, filename = 'index.js', rootDir = process.cwd(), params }) {
  const hbsTemplatePath = path.join(__dirname, `../templates/${template}`);
  const hbsTemplateContent = fse.readFileSync(hbsTemplatePath, 'utf-8');
  const compileTemplateContent = hbs.compile(hbsTemplateContent);

  const tempDir = path.join(rootDir, '.tmp');
  const jsPath = path.join(tempDir, filename);

  const jsTemplateContent = compileTemplateContent(params);
  fse.outputFileSync(jsPath, jsTemplateContent);

  return jsPath;
}

function parseNpmName(npmName) {
  if (typeof npmName !== 'string') {
    throw new TypeError('Expected a string');
  }
  const matched =
    npmName.charAt(0) === '@' ? /(@[^\/]+)\/(.+)/g.exec(npmName) : [npmName, '', npmName];
  if (!matched) {
    throw new Error(`[parse-package-name] "${npmName}" is not a valid string`);
  }
  const scope = matched[1];
  const name = (matched[2] || '').replace(/\s+/g, '').replace(/[\-_]+([^\-_])/g, ($0, $1) => {
    return $1.toUpperCase();
  });
  const uniqueName =
    (matched[1]
      ? matched[1].charAt(1).toUpperCase() +
        matched[1].slice(2).replace(/[\-_]+([^\-_])/g, ($0, $1) => {
          return $1.toUpperCase();
        })
      : '') +
    name.charAt(0).toUpperCase() +
    name.slice(1);
  return {
    scope,
    name,
    uniqueName,
  };
}

function camel2KebabComponentName(camel) {
  return camel
    .replace(/[A-Z]/g, (item) => {
      return `-${item.toLowerCase()}`;
    })
    .replace(/^\-/, '');
}

function kebab2CamelComponentName(kebab) {
  const camel = kebab.charAt(0).toUpperCase() + kebab.substr(1);
  return camel.replace(/-([a-z])/g, (keb, item) => {
    return item.toUpperCase();
  });
}

function generateComponentList(components) {
  const componentList = [
    {
      title: '常用',
      icon: '',
      children: [],
    },
    {
      title: '容器',
      icon: '',
      children: [],
    },
    {
      title: '导航',
      icon: '',
      children: [],
    },
    {
      title: '内容',
      icon: '',
      children: [],
    },
    {
      title: 'Feedback 反馈',
      icon: '',
      children: [],
    },
  ];

  components.forEach((comp) => {
    const category = comp.category || '其他';
    let target = componentList.find((item) => item.title === category);
    if (!target) {
      target = {
        title: category,
        icon: '',
        children: [],
      };

      componentList.push(target);
    }

    if (comp.snippets) {
      target.children.push({
        componentName: comp.componentName,
        title: comp.title || comp.componentName,
        icon: '',
        package: comp.npm.pkg,
        snippets: comp.snippets || [],
      });
    }
  });
  return componentList;
}

function replacer(key, value) {
  if (typeof value === 'function') {
    return {
      type: 'JSFunction',
      value: String(value),
    };
  }
  return value;
}

function isAsyncFunction(fn) {
  return fn[Symbol.toStringTag] === 'AsyncFunction';
}
function reviewer(key, value) {
  if (!value) {
    return value;
  }
  if (key === 'icon') {
    if (typeof value === 'object') {
      return {
        type: 'smile',
        size: 'small',
      };
    }
  }
  if (typeof value === 'object') {
    if (value.type === 'JSFunction') {
      let _value = value.value && value.value.trim();
      let template = `
        return function lowcode() {
          const self = this;
          try {
            return (${_value}).apply(self, arguments);
          } catch(e) {
            console.log('call function which parsed by lowcode for key ${key} failed: ', e);
            return e.message;
          }
        };`;
      try {
        return Function(template)();
      } catch (e) {
        if (e && e.message.includes("Unexpected token '{'")) {
          console.log('method need add funtion prefix');
          _value = `function ${_value}`;
          template = `
          return function lowcode() {
            const self = this;
            try {
              return (${_value}).apply(self, arguments);
            } catch(e) {
              console.log('call function which parsed by lowcode for key ${key} failed: ', e);
              return e.message;
            }
          };`;
          return Function(template)();
        }
        console.error('parse lowcode function error: ', e);
        console.error(value);
        return value;
      }
    }
  }
  return value;
}

function toJson(object, replacer) {
  return JSON.stringify(object, replacer || this.replacer, 2);
}

function parseJson(json) {
  const input = typeof json === 'string' ? json : JSON.stringify(json);
  return JSON.parse(input, this.reviewer);
}

function asyncDebounce(func, wait) {
  const debounced = _.debounce(async (resolve, reject, bindSelf, args) => {
    try {
      const result = await func.bind(bindSelf)(...args);
      resolve(result);
    } catch (error) {
      reject(error);
    }
  }, wait);

  // This is the function that will be bound by the caller, so it must contain the `function` keyword.
  function returnFunc(...args) {
    return new Promise((resolve, reject) => {
      debounced(resolve, reject, this, args);
    });
  }

  return returnFunc;
}

const mergeAssets = function(assets, targetAssets) {
  return mergeWith(assets, targetAssets, (objValue, srcValue) => {
    if (Array.isArray(objValue) && Array.isArray(srcValue)) {
      if (typeof objValue[0] === 'string') {
        const tempMap = {};
        srcValue.forEach((srcItem) => {
          tempMap[srcItem] = true;
        });
        objValue.forEach((objItem) => {
          if (!tempMap[objItem]) {
            srcValue.push(objItem);
          }
        });
        return srcValue;
      } else {
        return srcValue.concat(objValue);
      }
    }
  });
}

const fetchAssetsListData = async function(assetsList) {
  return await Promise.all(
    assetsList.map(async (url) => {
      if (typeof url === 'object') {
        return url;
      } else {
        try {
          return await axios(url).then(({ data }) => data);
        } catch (e) {
          console.error(
            `[@alifd/build-plugin-assets] get assets data from assets ${url} failed: `,
            e,
          );
          return {};
        }
      }
    }),
  );
}

const getBuiltInPackages = (baseComponent) => {
  if (!baseComponent) {
    return BaseBuiltinPackages;
  }
  return BuiltinPackagesMap[baseComponent];
};

const getHttpResource = async (url, contentType) => {
  if (!url) return false;
  const start = Date.now();
  const curlOption = {
    timeout: 10000,
  };
  try {
    const response = await axios.get(url, curlOption);
    const data = response && response.status === 200 && response.data;
    if (!data) {
      return;
    }
    return data;
  } catch (e) {
    console.log(`resource ${url} not exist or failed: ${e}, cost ${Date.now() - start} ms`);
    return false;
  }
};

const isHttpResourceExist = async (url) => {
  const res = await axios.get(url, {
    timeout: 10000,
  });
  const data = res && res.status === 200 && res.data;
  return !!data;
};

const isNpmResourceExist = async (npm, version, resourcePath) => {
  const url = `https://github.elemecdn.com/${npm}@${version}/${resourcePath}`;
  return !!(await this.isHttpResourceExist(url));
};

const deduplicationAssets = (assets) => {
  const packageMap = {};
  const componentMap = {};

  const { packages, components } = assets;
  const _packages = [];
  const _components = [];
  packages.forEach(item => {
    if (!packageMap[item.package]) {
      _packages.push(item);
      packageMap[item.package] = 1;
    }
  });
  components.forEach(item => {
    if (!componentMap[item.exportName]) {
      _components.push(item);
      componentMap[item.exportName] = 1;
    }
  });
  return {
    ...assets,
    packages: _packages,
    components: _components,
  };
};

module.exports = {
  toJson,
  parseProps,
  parseNpmName,
  generateEntry,
  asyncDebounce,
  generateComponentList,
  camel2KebabComponentName,
  kebab2CamelComponentName,
  mergeAssets,
  fetchAssetsListData,
  getBuiltInPackages,
  getHttpResource,
  isHttpResourceExist,
  isNpmResourceExist,
  deduplicationAssets,
};
