const { from } = require('rxjs');
const { writeFileSync } = require('fs');

const data = require('./output/find-private.json');

const heirarchy = {};

const arraySource = from(Object.keys(data));

const traceHeirarchies = (mainDataObj, item) => {
  const privateInvocations = mainDataObj[item].privateInvocations || [];
  return privateInvocations.reduce((obj, invocation) => {
    obj[invocation] = traceHeirarchies(mainDataObj, invocation);
    return obj;
  }, {});
};

arraySource.subscribe(
  val => {
    heirarchy[val] = traceHeirarchies(data, val);
  },
  undefined,
  () => {
    console.log('DONE');
    writeFileSync('./outtput/privateDeps.json', JSON.stringify(heirarchy, undefined, 2), 'utf8');
  }
);
