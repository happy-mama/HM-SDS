const crypto = require("crypto");
const fs = require("fs");

//  ___      ___     ____        ___
// /\  \    /\  \   /\   '.     /   \
// \ \  \   \ \  \  \ \     '._/     \
//  \ \  \___\_\  \  \ \  \.      /\  \             ______   _____    ______
//   \ \   ______  \  \ \  \ '.__/\ \  \           |  ____| |  __ \  |  ____|
//    \ \  \____ \  \  \ \  \'._/  \ \  \    ____  | |____  | |  \ \ | |____
//     \ \  \   \ \  \  \ \  \      \ \  \  |____| |____  | | |  | | |____  |
//      \ \__\   \ \__\  \ \__\      \ \__\         ____| | | |__/ /  ____| |
//       \/__/    \/__/   \/__/       \/__/        |______| |_____/  |______|
//

// COLORS

const Reset = "\x1b[0m";
const Bright = "\x1b[1m";
const Hidden = "\x1b[8m";

const FgBlack = "\x1b[30m";
const FgRed = "\x1b[31m";
const FgGreen = "\x1b[32m";
const FgYellow = "\x1b[33m";
const FgBlue = "\x1b[34m";
const FgMagenta = "\x1b[35m";
const FgCyan = "\x1b[36m";
const FgWhite = "\x1b[37m";
const FgGray = "\x1b[90m";

// #region VARIABLES

let password = "";
let data = {};
const NO_PASSWORD_REQUIRED_COMMANDS = ["help", "pas", "exit", "clear"];
let pointer = "-> ";
const RANDOM = {
  lowerCase: "abcdefghijklmnopqrstuvwxyz",
  upperCase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  number: "0123456789",
};

//#region READLINE

const readline = require("readline").createInterface({
  input: process.stdin,
  output: process.stdout,
});

//#region CLASSES

class CommandsManager {
  /**
   * @type {{[key: string]: Command}}
   */
  commands = {};

  constructor() {}

  /**
   * @param {Command & {callback: (params: string, flags: string[]) => void}}
   */
  add({ name, description, callback }) {
    this.commands[name] = new Command(name, description, callback);
  }
  /**
   * @param {string} name
   * @param {string[]} params
   */
  envoke(name, params) {
    return new Promise(async (result) => {
      const command = this.commands[name];

      if (command) {
        if (!NO_PASSWORD_REQUIRED_COMMANDS.includes(name) && !passCheck()) return result();

        if (!paramsCheck(command, params)) return result();

        const flags = params.filter((param) => param.startsWith("-"));
        params = params.filter((param) => !param.startsWith("-"));

        await command.run(params, flags);
      } else {
        console.log("No command");
      }

      result();
    });
  }
}

class Command {
  name = "";

  /**
   * @type {{main: string, params: string[][], args: string[][]}}
   */
  description = {
    main: "",
    params: [],
    args: [],
  };

  /**
   * @param {string} params
   * @param {string[]} flags
   */
  run = (params, flags) => {};

  constructor(name, description, callback) {
    this.name = name;
    this.description = description;
    this.run = callback;
  }
}

//#region FUNCTIONS

const initMessage = () => {
  console.log(Bright + FgYellow + 'HM-SDS tool. Type "help" to get avaliable commands' + Reset);
};

const passCheck = () => {
  if (!password) {
    console.log(FgRed + 'Enter password before performing operation, type "pas"' + Reset);
    return false;
  }

  return true;
};

/**
 *
 * @param {Command} command
 * @param {string[]} params
 */
const paramsCheck = (command, params) => {
  const requiredParams = command.description.params.filter((param) => !param[0].startsWith("?"));

  if (requiredParams.length > params.length) {
    const missingParam = command.description.params[params.length];

    console.log(
      FgRed +
        "missing param" +
        Reset +
        FgCyan +
        ` <${missingParam[0]}> ` +
        Reset +
        `${missingParam[1]}`
    );

    return false;
  }

  return true;
};

const saveData = () => {
  fs.writeFileSync(__dirname + "/data.txt", encrypt(JSON.stringify(data, {}, 2), password));
};

const getDirData = () => {
  return fs.readdirSync(__dirname);
};

/**
 * @param {string} text
 * @param {string} password
 * @returns {string}
 */
function encrypt(text, password) {
  const key = crypto.createHash("sha256").update(password).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

/**
 * @param {string} text
 * @param {string} password
 * @returns {string}
 */
function decrypt(encrypted, password) {
  try {
    const [ivHex, encryptedHex] = encrypted.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const encryptedText = Buffer.from(encryptedHex, "hex");
    const key = crypto.createHash("sha256").update(password).digest();
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return "Wrong password";
  }
}

async function sha256(message) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex; // длина 64 символа
}

function colorfulOutput(string) {
  return string
    .replace(/(=)/g, `${FgRed}$1${Reset}`)
    .replace(/(https?:\/\/)/g, `${FgBlue}$1${Reset}`);
}

//#region COMMANDS

const CM = new CommandsManager();

CM.add({
  name: "help",
  description: {
    main: "Get list of all commands",
    params: [],
    args: [],
  },
  callback: (params) => {
    let result = "";
    let keys = Object.keys(CM.commands);

    keys.forEach((key, i) => {
      const command = CM.commands[key];

      const params = command.description.params.reduce(
        (acc, cur) => acc + `\n  ${FgCyan}<${cur[0]}>${Reset} ${cur[1]}`,
        ""
      );

      const args = command.description.args.reduce(
        (acc, cur) => acc + `\n  ${FgMagenta}${cur[0]}${Reset} ${cur[1]}`,
        ""
      );

      result += `${FgGreen}${key}${Reset}` + `\n  ${command.description.main}` + params + args;

      if (i < keys.length - 1) {
        result += "\n";
      }
    });

    console.log(result);
  },
});

CM.add({
  name: "pas",
  description: {
    main: "Set password for current session",
    params: [],
    args: [],
  },
  callback: (params) => {
    return new Promise((resolve) => {
      readline.question(FgMagenta + pointer, (pass) => {
        readline.output.write = originalWrite;

        readline.history.shift();

        fs.promises
          .readFile("data.txt", { encoding: "utf-8" })
          .then((file) => {
            if (file.length) {
              const tempData = decrypt(file, pass);

              if (tempData == "Wrong password") {
                console.log(FgRed + tempData + Reset);
                return resolve();
              }

              data = JSON.parse(tempData);
            }

            password = pass;
            pointer = "+> ";

            console.log(FgGreen + "Success" + Reset);
            resolve();
          })
          .catch(() => {
            password = pass;
            pointer = "+> ";

            console.log(FgGreen + "Success" + Reset);
            resolve();
          });
      });

      const originalWrite = readline.output.write;
      readline.output.write = function () {};
    });
  },
});

CM.add({
  name: "enc",
  description: {
    main: "Encrypts any value to data.txt",
    params: [
      ["key", "KEY of value"],
      ["data+", "any value"],
    ],
    args: [],
  },
  callback: (params) => {
    let key = params[0];
    let message = params.slice(1).join(" ").replaceAll("\\n", "\n");

    data[key] = encrypt(message, password);

    saveData();

    console.log(FgGreen + "Success" + Reset);
  },
});

CM.add({
  name: "enct",
  description: {
    main: 'works like "enc" but with template',
    params: [
      ["key", "KEY of value"],
      ["login", "any value"],
      ["pas", "any value"],
      ["?info+", "any value"],
    ],
    args: [],
  },
  callback: (params) => {
    const key = params[0];
    const login = params[1];
    const pas = params[2];
    const info = params.slice(3).join(" ").replaceAll("\\n", "\n");

    const value = `${login}  =  ${pas}` + (info ? `\n ${info}` : "");

    data[key] = encrypt(value, password);

    saveData();

    console.log(FgGreen + "Success" + Reset);
  },
});

CM.add({
  name: "dec",
  description: {
    main: "Decrypts key from data.txt",
    params: [["key", "KEY of value"]],
    args: [],
  },
  callback: (params) => {
    let key = params[0];

    if (!data[key]) {
      return console.log(FgRed + "No such key in data.json" + Reset);
    }

    console.log(decrypt(data[key], password));
  },
});

CM.add({
  name: "decall",
  description: {
    main: 'Decrypt all keys from data.txt and save output to "rawAll.json"',
    params: [],
    args: [],
  },
  callback: (params) => {
    result = {};

    Object.keys(data).forEach((key) => {
      result[key] = decrypt(data[key], password);
    });

    fs.writeFileSync(__dirname + "/rawAll.json", JSON.stringify(result, {}, 2));

    console.log(FgGreen + 'Succesfuly decrypted all data to "rawAll.json"' + Reset);
  },
});

CM.add({
  name: "encall",
  description: {
    main: 'Encrypt all data from "rawAll.json" to data.txt',
    params: [],
    args: [["-s", "Will not delete rawAll.json"]],
  },
  callback: (params, flags) => {
    const dirData = getDirData();

    if (!dirData.includes("rawAll.json")) {
      return console.log(FgRed + '"rawAll.json" not found' + Reset);
    }

    let rawData = JSON.parse(fs.readFileSync(__dirname + "/rawAll.json", "utf8"));

    Object.keys(rawData).forEach((key) => {
      data[key] = encrypt(rawData[key], password);
    });

    if (!flags.includes("-s")) {
      fs.rmSync(__dirname + "/rawAll.json");
    }

    saveData();

    console.log(FgGreen + "Succesfuly encrypted all data" + Reset);
  },
});

CM.add({
  name: "del",
  description: {
    main: "Delete key and value",
    params: [["key", "KEY of value"]],
    args: [],
  },
  callback: (params) => {
    const key = params[0];

    if (!data[key]) {
      return console.log(FgRed + "No such key in data.json" + Reset);
    }

    delete data[key];
    saveData();

    console.log(FgGreen + "Success" + Reset);
  },
});

CM.add({
  name: "list",
  description: {
    main: "Show key list",
    params: [["?search", "KEY name"]],
    args: [
      ["-e", "decrypts data"],
      ["-c", "colorful decrypted data"],
    ],
  },
  callback: (params, flags) => {
    const keys = Object.keys(data);
    let result = "";

    if (params[0]) {
      const filteredKeys = keys.filter((key) => key.toLowerCase().includes(params[0]));

      if (flags.includes("-e")) {
        if (flags.includes("-c")) {
          result = filteredKeys
            .map(
              (key) => `${FgGreen}${key}:${Reset} ${colorfulOutput(decrypt(data[key], password))}`
            )
            .join("\n");
        } else {
          result = filteredKeys.map((key) => `${key}: ${decrypt(data[key], password)}`).join("\n");
        }
      } else {
        result = filteredKeys.join("\n");
      }
    } else {
      if (flags.includes("-e")) {
        if (flags.includes("-c")) {
          result = keys
            .map(
              (key) => `${FgGreen}${key}:${Reset} ${colorfulOutput(decrypt(data[key], password))}`
            )
            .join("\n");
        } else {
          result = keys.map((key) => `${key}: ${decrypt(data[key], password)}`).join("\n");
        }
      } else {
        result = keys.join("\n");
      }
    }

    if (!result) {
      return console.log(FgRed + "Nothing found" + Reset);
    }

    console.log(result);
  },
});

CM.add({
  name: "chash",
  description: {
    main: "Create random hash",
    params: [["?length", "hash length, default is 64"]],
    args: [],
  },
  callback: async (params) => {
    const hashLength = Number(params[0]);

    if (params[0]) {
      if (!hashLength) {
        return console.log(FgRed + "Wrong length" + Reset);
      }

      if (isNaN(hashLength)) {
        return console.log(FgRed + "Length is not a number" + Reset);
      }

      if (hashLength > 256) {
        return console.log(FgRed + "Length must be less than 256" + Reset);
      }

      if (hashLength < 0) {
        return console.log(FgRed + "Length must be greater than 0" + Reset);
      }
    }

    const generate64 = async () => {
      let randomSeed = "";
      const randomDict = Object.entries(RANDOM);

      for (let i = 0; i < 256; i++) {
        const selector = crypto.randomInt(3);
        const buf = randomDict[selector][1];
        randomSeed += buf[crypto.randomInt(buf.length)];
      }

      const randomHash = encrypt(randomSeed, password);
      return await sha256(randomHash);
    };

    if (hashLength) {
      const repeat = Math.ceil(hashLength / 64);
      let hash = "";

      for (let i = repeat; i > 0; i--) {
        hash += await generate64();
      }

      console.log(hash.slice(0, hashLength));
    } else {
      console.log(await generate64());
    }
  },
});

CM.add({
  name: "clear",
  description: {
    main: "Clear console",
    params: [],
    args: [],
  },
  callback: () => {
    process.stdout.write("\x1Bc");
    console.clear();
    initMessage();
  },
});

CM.add({
  name: "exit",
  description: {
    main: "Exit programm",
    params: [],
    args: [],
  },
  callback: () => {
    process.exit(1);
  },
});

//#region LOOP

const loop = () => {
  readline.question(FgCyan + pointer + Reset, (input) => {
    let name = input.split(" ")[0];
    let params = input
      .split(" ")
      .slice(1)
      .filter((param) => !!param);

    CM.envoke(name, params).then(() => {
      loop();
    });
  });
};

console.clear();
initMessage();
loop();
