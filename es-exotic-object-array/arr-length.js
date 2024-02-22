var arr = [];
arr.length = 10;
console.log(arr.length); // 10

arr.push(1);
console.log(arr.length); // 11

arr.forEach((_0, i) => {
  console.log(`i: ${i}`); // i=10
});
