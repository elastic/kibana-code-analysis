const { from } = require('rxjs');

const data = require('./output/find-private.json');

const arraySource = from(Object.keys(data));

console.log(
  `Provider\tUsages\tParams Count\tProvider Invocations Count\tInjector Invocations Count\tParams\tPrivate Invocations\tInjetor Invocations`
);
arraySource.subscribe(val => {
  const provider = data[val];

  console.log(
    `${val}\t${(provider.refs || []).length}\t${(provider.params || []).length}\t${
      (provider.privateInvocations || []).length
    }\t${(provider.injectorInvocations || []).length}\t${provider.params ||
      []}\t${provider.privateInvocations || []}\t${provider.injectorInvocations || []}`
  );
});
