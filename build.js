
const fs = require('fs')
const UglifyJS = require("uglify-js");

console.log("");

const createDate = process.env.CREATE_DATE
if (!createDate) {
  console.log('Usage: CREATE_DATE="2021-09-15" yarn build');
  process.exit(1);
}

const buildType = process.env.BUILD_TYPE

let data;
try {
  data = fs.readFileSync('calamari.js', 'utf8')
} catch (err) {
  console.error(err);
  process.exit(1);
}

data = data.replace("%%CREATE_DATE%%", createDate);
minified = UglifyJS.minify(data);
if (buildType === "bookmarklet") {
  console.log("javascript:" + minified.code.split('%').join('%25'));
} else if (buildType === "console") {
  console.log(minified.code);
} else {
  console.log("invalid build type")
  process.exit(1)
}
