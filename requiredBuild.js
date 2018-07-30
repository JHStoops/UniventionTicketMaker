//Customizes chat design
const buildNum = OnTimeComboLoader.split('.')[4];
const cookie = document.cookie;
document.cookie = `buildNum=${buildNum}; ${cookie}`;
console.log(document.cookie)
