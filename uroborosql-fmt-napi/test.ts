const { runfmt } = require("./index.js");

const input = 
`
select a, b
from tab1, tab2
where tab1.num = 1
`;

const res = runfmt(input);
console.log(res);

