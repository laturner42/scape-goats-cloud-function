const fs = require('fs');
const axios = require('axios');

const realWords = [];
const fakeWords = [];

let i = 0;
const atATime = 50;

const allWords = fs.readFileSync('wordDictionary.txt', 'utf8')
  .split('\n');

console.log('Before filter', allWords.length);

// const states = fs.readFileSync('states.txt', 'utf8')
//   .split('\n').map(w => w.toLowerCase().trim());

// const countries = fs.readFileSync('countries.txt', 'utf8')
//   .split('\n').map(w => w.toLowerCase().trim());

const names = fs.readFileSync('names2.txt', 'utf8')
  .split('\n').map(w => w.toLowerCase().trim());

const filteredWords = allWords.filter(w => !names.includes(w));

console.log('After filter', filteredWords.length);

fs.writeFileSync('wordDictionary.txt', filteredWords.join('\n'));

const lookUpTenWords = (i) => {
  if (i > allWords.length) {
    fs.writeFileSync('realWords.txt', realWords.join('\n'));
    fs.writeFileSync('fakeWords.txt', fakeWords.join('\n'));
    return;
  };
  console.log('Looking up', i, 'to', i + atATime);
  Promise.all(
    allWords
      .slice(i, i + atATime)
      .map((word) => {
        // console.log('Looking up word', word);
        return axios.get(`https://www.wordsapi.com/mashape/words/${word}/definitions?when=2019-03-03T22:19:22.652Z&encrypted=8cfdb283e722909bea9207bded58bfb0aeb22f0936fa95b8`)
          .then((res) => {
            const data = res.data;
            if (data.definitions && data.definitions.length > 0) {
              realWords.push(word);
              // console.log(word, 'was real.');
            } else {
              fakeWords.push(word);
              // console.log(word, 'was fake.');
            }
          })
          .catch((err) => {
            console.error(err.toString(), word);
            fakeWords.push(word);
            // console.log(word, 'was fake.');
          })
      })
  ).then(() => lookUpTenWords(i + atATime));
}