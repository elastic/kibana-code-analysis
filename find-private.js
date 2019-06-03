/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

const { relative, resolve: resolvePath } = require('path');
const { readFileSync, writeFileSync } = require('fs');
const { map } = require('lodash');
const { resolve } = require('./resolve');

const providerMap = {};

const argumentFromCall = call =>
  call.value.arguments.map(identifier => identifier.value || identifier.name)[0];

const filterPrivateCalls = call => call.value.callee.loc.identifierName === 'Private';

const getPrivateInvocations = (codeblock, jscodeshift) => {
  let privateInvocations;
  jscodeshift(codeblock)
    .find(jscodeshift.CallExpression)
    .filter(filterPrivateCalls)
    .forEach(call => {
      privateInvocations = privateInvocations || [];
      privateInvocations.push(argumentFromCall(call));
    });
  return privateInvocations;
};

const getInjectorInvocations = (codeblock, jscodeshift) => {
  let injectorInvocations;
  jscodeshift(codeblock)
    .find(jscodeshift.CallExpression)
    .filter(call => call.value.callee.object && call.value.callee.object.name === '$injector')
    .forEach(call => {
      injectorInvocations = injectorInvocations || [];
      injectorInvocations.push(argumentFromCall(call));
    });
  return injectorInvocations;
};

// such as `export { foo }`
const excludeSimpleExportStatements = ident =>
  !(
    ident.parentPath.value.type === 'ExportSpecifier' &&
    !ident.parentPath.parentPath.parentPath.value.source
  );

const isIdentifierPartOfImport = ident =>
  ident.parentPath.parentPath.parentPath.value.type === 'ImportDeclaration' ||
  ident.parentPath.parentPath.parentPath.value.type === 'ExportNamedDeclaration';

const identifierToImportSource = ident => ident.parentPath.parentPath.parentPath.value.source.value;
const getParamsFromFn = identifier =>
  // FunctionDeclaraion and VariableDeclaration are slightly different
  map(identifier.parentPath.value.params || identifier.parentPath.value.init.params, 'name');

const findDeclaration = (source, providerName, jscodeshift, path) => {
  let declarationType = {
    type: 'unknown'
  };
  jscodeshift(source)
    .find(jscodeshift.Identifier)
    .filter(ident => ident.value.name === providerName)
    .filter(ident => ident.parentPath.parentPath.value.type !== 'CallExpression') // filter out where passed as param
    .filter(excludeSimpleExportStatements) // filters out export statements that reference variables
    .forEach(ident => {
      if (isIdentifierPartOfImport(ident)) {
        let importSource = identifierToImportSource(ident);
        const pathRelativeToKibana = relative('../kibana', path);

        declarationType = {
          type: 'ImportSpecifier',
          source: importSource,
          path
        };

        // accountinf for webpack aliases
        if (importSource.startsWith('fixtures/')) {
          importSource = relative(pathRelativeToKibana, `src/${importSource}`);
        }
        if (importSource.startsWith('ui/')) {
          // dangerouslyGetActiveInjector
          // todo handle uiRegistry
          // verify source paths
          importSource = relative(
            pathRelativeToKibana,
            `src/legacy/ui/public/${importSource
              .split('/')
              .slice(1)
              .join('/')}`
          )
            .split('/')
            .slice(1)
            .join('/');
        }
        if (importSource.startsWith('plugins/ml/')) {
          importSource = relative(
            pathRelativeToKibana,
            `x-pack/plugins/ml/public/${importSource
              .split('/')
              .slice(2)
              .join('/')}`
          )
            .split('/')
            .slice(1)
            .join('/');
        }

        if (importSource.startsWith('plugins/')) {
          const sourceSecondItem = importSource.split('/')[1];
          importSource = relative(
            pathRelativeToKibana,
            `x-pack/plugins/${sourceSecondItem}/public/${importSource
              .split('/')
              .slice(2)
              .join('/')}`
          )
            .split('/')
            .slice(1)
            .join('/');
        }

        // only able to follow relative paths
        if (!importSource.startsWith('.')) {
          console.log(`UNSUPPORTED - ${importSource} ${path}`);
          return;
        }

        const { path: resolvedImportPath } = resolve(importSource, path);

        if (!resolvedImportPath) {
          console.log('FAIL:', importSource, path, providerName);
          console.log(resolvePath(path, importSource));
        } else {
          console.log('SUCCESS:', importSource, path, providerName);
          const importPathCode = readFileSync(resolvedImportPath).toString();
          declarationType = findDeclaration(
            importPathCode,
            providerName,
            jscodeshift,
            resolvedImportPath
          );
        }
      }

      /*
      if (ident.parentPath.value.type === 'FunctionDeclaration') {
        declarationType = {
          type: 'FunctionDeclaration',
          params: map(ident.parentPath.value.params, 'name'),
          privateInvocations: getPrivateInvocations(ident.parentPath.value.body, jscodeshift),
          injectorInvocations: getInjectorInvocations(ident.parentPath.value.body, jscodeshift),
          path
        };
      }
      */
      if (
        ident.parentPath.value.type === 'VariableDeclarator' ||
        ident.parentPath.value.type === 'FunctionDeclaration'
      ) {
        const isCallExpression = identifier =>
          identifier.parentPath.value.init &&
          identifier.parentPath.value.init.type === 'CallExpression';
        const getBody = identifier =>
          identifier.parentPath.value.body || identifier.parentPath.value.init.body.body;

        declarationType = {
          type: 'VariableDeclarator',
          params: getParamsFromFn(ident), // map(ident.parentPath.value.init.params, 'name'),
          privateInvocations: isCallExpression(ident)
            ? []
            : getPrivateInvocations(getBody(ident), jscodeshift),
          injectorInvocations: isCallExpression(ident)
            ? []
            : getInjectorInvocations(getBody(ident), jscodeshift),
          path
        };
      }
    });
  return declarationType;
};

module.exports = function findPrivate({ path, source }, { jscodeshift }) {
  jscodeshift(source)
    .find(jscodeshift.CallExpression) // find function calls
    .filter(filterPrivateCalls)
    .forEach(call => {
      const providerName = argumentFromCall(call);
      const { start } = call.value.callee.loc;
      const params = findDeclaration(source, providerName, jscodeshift, path);

      if (!providerMap[providerName]) {
        providerMap[providerName] = { refs: [] };
      }
      providerMap[providerName].params = params.params;
      providerMap[providerName].privateInvocations = params.privateInvocations;
      providerMap[providerName].injectorInvocations = params.injectorInvocations;
      providerMap[providerName].source = params.path && relative('../kibana/', params.path);
      providerMap[providerName].refs.push({
        path: relative('../kibana/', path),
        startLine: start.line,
        startColumn: start.column
      });

      writeFileSync('./output/find-private.json', JSON.stringify(providerMap, null, 2), 'utf8');
    });
};
module.exports.parser = 'tsx';
