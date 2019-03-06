const functions = require('firebase-functions');
const fs = require('fs');
const _ = require('lodash');
const admin = require('firebase-admin');
const axios = require('axios');
const cors = require('cors')({
  origin: true,
});

admin.initializeApp(functions.config().firebase);
const db = admin.firestore();

console.log('Loading literally all words...');
const literallyAllWords = fs.readFileSync('2of12inf.txt', 'utf8')
  .split('\n')
  .map(w => w.replace('%', '').trim())
  .filter(w => w.length >= 3 && w.length <= 7);
console.log('Loaded literally all words.', literallyAllWords.length);

const placeWord = (map, letterLocations, word, r, c, vertical) => {
  const letters = word.split('');
  for (let i=0; i<word.length; i++) {
    const letter = letters[i];
    const location = vertical ? [r + i, c] : [r, c + i];
    map[location[0]][location[1]] = word.split('')[i];
    letterLocations[letter].add(location.join(','));
  }
  return {
    word, r, c, vertical
  };
}

const inMap = (map, r, c) => {
  if (!map[r]) return undefined;
  return map[r][c];
}

const getWorthOfFit = (map, word, r, c, vertical) => {
  let worth = 0;
  let backToBack = false;
  if (vertical) {
    if (inMap(map, r-1, c) !== '.') {
      return -1;
    }
    if (inMap(map, r + word.length, c) !== '.') {
      return -1;
    }
    word.split('').map((letter, i) => {
      if (worth < 0) return;
      const mapLetter = inMap(map, r+i, c)
      if (mapLetter !== '.') {
        if (mapLetter === letter && i !== 1 && !backToBack) {
          worth += 1;
          backToBack = true;
        } else {
          worth = -1;
        }
      } else if (inMap(map, r+i, c-1) !== '.' || inMap(map, r+i, c+1) !== '.') {
        worth = -1;
      } else {
        backToBack = false;
      }
    });
  } else {
    if (inMap(map, r, c-1) !== '.') {
      return -1;
    }
    if (inMap(map, r, c + word.length) !== '.') {
      return -1;
    }
    word.split('').map((letter, i) => {
      if (worth < 0) return;
      const mapLetter = inMap(map, r, c+i)
      if (mapLetter !== '.') {
        if (mapLetter === letter && i !== 1) {
          worth += 1;
          backToBack = true;
        } else {
          worth = -1;
        }
      } else if (inMap(map, r+1, c+i) !== '.' || inMap(map, r-1, c+i) !== '.') {
        worth = -1;
      } else {
        backToBack = false;
      }
    });
  }
  return worth;
}

const generateThePuzzle = () => {
  const map = [];
  const allLetters = 'abcdefghijklmnopqrstuvwxyz';
  const letterLocations = allLetters.split('').reduce((out, l) => { out[l] = new Set(); return out; }, {});

  for (let i=0; i<20; i++) {
    const row = [];
    for (let h=0; h<20; h++) {
      row[h] = '.';
    }
    map[i] = row;
  }

  const placedWords = [];

  let lettersToUse;
  let words = [];

  while (words.length < 12) {
    lettersToUse = _.shuffle(
      literallyAllWords.filter(w => w.length >= 5 && w.length <= 7)
    )[0].split('');
    words = _.shuffle(literallyAllWords.filter((word) => {
      let remainingWord = word;
      lettersToUse.map((letter) => {
        remainingWord = remainingWord.replace(letter, '');
      });
      if (remainingWord.length === 0) return true;
      return false;
    }));
    console.log('Longest word chosen:', lettersToUse);
  }

  lettersToUse = _.shuffle(lettersToUse);
  console.log('Possible words', words);

  const bonusWords = [];
  
  words.map((word) => {
    if (placedWords.length === 0) {
      const x = 8;
      const y = 8;
      placedWords.push(
        placeWord(map, letterLocations, word, x, y, 0)
      );
    } else {
      const letters = word.split('');
      let bestFit = 0;
      let bestFitSpace = null;
      let vertical = false;
      letters.map((letter, i) => {
        const locations = Array.from(letterLocations[letter]).map(l => l.split(',')).map(([r, c]) => [parseInt(r), parseInt(c)]);
        locations.map(([r, c]) => {
          const hWorth = getWorthOfFit(map, word, r, c-i, false);
          const vWorth = getWorthOfFit(map, word, r-i, c, true);
          if (hWorth > bestFit ||
            (hWorth === bestFit && Math.random() > 0.5)) {
            bestFit = hWorth;
            bestFitSpace = [r, c-i];
            vertical = false;
          }
          if (vWorth > bestFit ||
            (vWorth === bestFit && Math.random() > 0.5)) {
            bestFit = vWorth;
            bestFitSpace = [r-i, c];
            vertical = true;
          }
        });
      });
      if (bestFitSpace) {
        placedWords.push(
          placeWord(map, letterLocations, word, bestFitSpace[0], bestFitSpace[1], vertical)
        );
      } else {
        bonusWords.push(word);
      }
    }
  });

  // let topString = '  ';
  // for (let t=0; t<20; t++) {
  //   topString += `${t < 10 ? ' ' : ''}${t} `;
  // }
  // console.log(topString);
  // map.map((row, i) => {
  //   console.log(`${i < 10 ? ' ' : ''}${i} ` + row.map(x => x === '.' ? ' ' : x.toUpperCase()).join('  '));
  // });
  console.log('Words placed:', placedWords.length, '/', words.length);
  console.log('Bonus words:', bonusWords);

  return {
    placedWords, lettersToUse, bonusWords,
  }
};

const lookupWord = (word) => {
  return axios.get(`https://od-api.oxforddictionaries.com/api/v1/entries/en/${word}`,
      {
        headers: {
          "Accept": "application/json",
          "app_id": "4b44b7ab",
          "app_key": "fcb9ae3a6232a5651d8504e999c07358"
        }
      })
      .then((resp) => {
        const definition =
          resp.data.results[0].lexicalEntries.map(
            entry => entry.entries.map(e => e.senses.map(s => s.definitions))).flat().flat().flat().flat();
        return definition;
      })
      .catch((err) => {
        console.error(err);
        throw err.toString();
      })
}

exports.getDefinition = functions.https.onRequest((req, res) => {
  console.log('Looking up', req.query.word);
  return lookupWord(req.query.word)
    .then((def) => res.json(def))
    .catch((err) => res.status(400).send(err));
  });

exports.generateCrossword = functions.https.onRequest((req, res) => {
  const puzzle = generateThePuzzle();
  console.log(puzzle);
  return db.collection('puzzles')
    .add({
      ...puzzle,
      foundWords: [],
      key: '',
    })
    .then((ref) =>
      cors(req, res, () => res.json({
        id: ref.id,
      }))
    )
});