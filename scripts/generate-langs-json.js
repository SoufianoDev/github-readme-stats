import axios from "axios";
import fs from "fs";
import jsYaml from "js-yaml";

const LANGS_FILEPATH = "./src/common/languageColors.json";
const LANGS_JS_FILEPATH = "./src/common/languageColors.js";

//Retrieve languages from github linguist repository yaml file
//@ts-ignore
axios
  .get(
    "https://raw.githubusercontent.com/github/linguist/master/lib/linguist/languages.yml",
  )
  .then((response) => {
    //and convert them to a JS Object
    const languages = jsYaml.load(response.data);

    const languageColors = {};

    //Filter only language colors from the whole file
    Object.keys(languages).forEach((lang) => {
      languageColors[lang] = languages[lang].color;
    });

    //Debug Print
    //console.dir(languageColors);
    fs.writeFileSync(
      LANGS_FILEPATH,
      JSON.stringify(languageColors, null, "    "),
    );
    fs.writeFileSync(
      LANGS_JS_FILEPATH,
      `export default ${JSON.stringify(languageColors, null, 2)};\n`,
    );
  });
