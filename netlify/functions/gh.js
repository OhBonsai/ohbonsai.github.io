var gh = require('gh-pages');


exports.handler = async function (event) {
  console.log(`Starting sync to gh-pages`);

  gh.publish('public', {
    repo: 'https://' + process.env.GH_TOKEN + '@github.com/OhBonsai/ohbonsai.github.io.git',
    silent: true
  }, ()=>{

  });

  console.log(`End sync to gh-pages`);
};