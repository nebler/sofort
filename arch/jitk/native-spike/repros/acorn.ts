import {parse} from 'acorn';
console.log(parse('const x = 2;', {ecmaVersion:'latest'}).body.length);
