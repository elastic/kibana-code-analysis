# kibana-code-analysis

Code to analyze the kibana codebase. Assumes the kibana codebase is located next to the clone of this repo - `../kibana`.

This currently does exactly one thing - it finds `Private` invocations, looks at the argument (provider) passed to `Private`, and creates a json object of the file paths based on the provider name.

0) clone repo next to your kibana repo
1) `yarn`
2) `yarn run find-private`
3) Grab a nice beverage, this is going to take a minute or two.
4) Look at `output/find-private.json`

5) `yarn run find-private-deps`
6) `yarn start`
7) http://localhost:8000
