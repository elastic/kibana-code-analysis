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


const { relative } = require('path');
const fs = require('fs');
const providerMap = {};

const argumentFromCall = call => call.value.arguments.map(identifier => identifier.name)[0];
const filterDepInjectors = call => ['Private','$injector'].indexOf(call.value.callee.loc.identifierName) > -1;
const identifierToImportSource = identifier => identifier.parentPath.parentPath.parentPath.value.source.value;
const resolveImports = (importPath, filePath) => {
  if(importPath.startsWith('ui/')){
    importPath = `src/legacy/ui/public/${importPath.split('/').slice(1).join('/')}`;
  }
  if(importPath.startsWith('.')){
    const dir = path.dirname(filePath);
    const resolvedPath = path.normalize(`${dir}/${importPath}`)
    // path = ``;
    console.log('relative path!')
    console.log(resolvedPath);
  }
  return importPath;
};


 module.exports = function ({ path, source }, { jscodeshift }) {
  const arr = [];
  const instances = jscodeshift(source)
    .find(jscodeshift.CallExpression)
    .filter(filterDepInjectors)
    .forEach(function (call){
      const providerName = argumentFromCall(call);
      if( !providerMap[providerName]){
        // using set since I'm getting dupes
        //providerMap[providerName] = { refs: new Set() };
        providerMap[providerName] = { refs: [] };
      }
      providerMap[providerName].refs.push(relative('../kibana/',path));
      const start = call.value.callee.loc.start;
      console.log(`${call.value.callee.loc.identifierName}\t${argumentFromCall(call)}\t${path}\t${start.line}\t${start.column}`);
      fs.writeFileSync('./output/find-private.json', JSON.stringify(providerMap, null, 2), 'utf8');
/*

NOTE - sometimes require statements
      jscodeshift(source)
        .find(jscodeshift.Identifier)
        .filter(identifier => identifier.value.name === argumentFromCall(call))
        .at(0)
        .forEach(ident => {
        //const importSource = identifierToImportSource(ident).split('/').slice(1).join('/');
        const importSource = identifierToImportSource(ident);

        //console.log('****', resolveImports(importSource, path), '****\n\n');

        })
        /*
        todo - resolve import statements to file contents and parse
        look for export statement
        follow statement, resolve import
        look for identifier, variableDeclaration
        ug, uiRegistry - takes private and injector
        */
    })
    /*
    if(arr.length){
    console.log(`${path}\n${arr.join('\n')}\n`);
    }
    */
};
module.exports.parser = 'tsx';
/*

determine if argument is string / or which injector it is

search for Identifier by name, note if its part of an import statement, resolve and loop through import statements



OTHER IDEA
- find all top level module references
- find all Private usage
- remove Private, pass in references instead
- injector references also need to get lifted

NEED - a definition of 'top level'
- to undo uiExports
*/
