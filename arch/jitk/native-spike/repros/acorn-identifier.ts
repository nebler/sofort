import {parse} from 'acorn';
console.log(parse('value', {ecmaVersion:'latest'}).body.length);
