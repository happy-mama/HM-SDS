const crypto = require("crypto");
const fs = require("fs");

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

// VARIABLES

let password = "";
let data = {};
let NO_PASSWORD_REQUIRED_COMMANDS = ["help", "pas", "exit", "clear"];
let pointer = "-> ";

// READLINE

const readline = require("readline").createInterface({
  input: process.stdin,
  output: process.stdout,
});

// CLASSES

class CommandsManager {
  commands = {};

  constructor() {}

  add(name, description, callback) {
    this.commands[name] = new Command(name, description, callback);
  }
  envoke(name, params) {
    return new Promise(async (result) => {
      if (this.commands[name]) {
        if (!NO_PASSWORD_REQUIRED_COMMANDS.includes(name) && !passCheck()) return result();

        const flags = params.filter((param) => param.startsWith("-"));

        await this.commands[name].run(params, flags);
      } else {
        console.log("No command");
      }

      result();
    });
  }
}

class Command {
  name = "";
  description = "";

  constructor(name, description, code) {
    this.name = name;
    this.run = code;
    this.description = description;
  }
}

// FUNCTIONS

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
  const iv = crypto.randomBytes(16); // 16 байт IV
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

// COMMANDS

const CM = new CommandsManager();

CM.add("help", "Get list of all commands", (params) => {
  let result = "";
  let keys = Object.keys(CM.commands);

  keys.forEach((key, i) => {
    result += `${FgGreen}${key}${Reset} - ${CM.commands[key].description}`;
    if (i < keys.length - 1) {
      result += "\n";
    }
  });

  console.log(result);
});

CM.add("pas", "Set password for current session", (params) => {
  return new Promise((resolve) => {
    readline.question(FgMagenta + pointer + Hidden, (pass) => {
      readline.output.write = originalWrite;

      if (!pass) {
        console.log(FgRed + "Wrong arg <password>" + Reset);
        return resolve();
      }

      let dataTxt = fs.readFileSync("./data.txt", { encoding: "utf-8" });

      if (dataTxt) {
        const tempData = decrypt(dataTxt, pass);

        if (tempData == "Wrong password") {
          console.log(Reset + FgRed + tempData + Reset);
          return resolve();
        }

        data = JSON.parse(tempData);
      }

      password = pass;
      pointer = "+> ";

      console.log(Reset + FgGreen + "Success" + Reset);
      resolve();
    });

    const originalWrite = readline.output.write;
    readline.output.write = function () {};
  });
});

CM.add("enc", "enc <key> <string> | Encrypt string to data.json", (params) => {
  let key = params[0];
  let message = params.slice(1).join(" ").replaceAll("\\n", "\n");

  data[key] = encrypt(message, password);
  saveData();

  console.log(FgGreen + "Success" + Reset);
});

CM.add("dec", "dec <key> | Decrypt key from data.json", (params) => {
  let key = params[0];

  if (!key) {
    return console.log(FgRed + "Wrong arg <key>" + Reset);
  }

  if (!data[key]) {
    return console.log(FgRed + "No such key in data.json" + Reset);
  }

  console.log(decrypt(data[key], password));
});

CM.add("decall", 'Decrypt all keys from data.json and save output to "rawAll.json"', (params) => {
  result = {};

  Object.keys(data).forEach((key) => {
    result[key] = decrypt(data[key], password);
  });

  fs.writeFileSync(__dirname + "/rawAll.json", JSON.stringify(result, {}, 2));

  console.log(FgGreen + 'Succesfuly decrypted all data to "rawAll.json"' + Reset);
});

CM.add("encall", 'Encrypt all data from "rawAll.json" to data.json', (params) => {
  const dirData = getDirData();

  if (!dirData.includes("rawAll.json")) {
    return console.log(FgRed + '"rawAll.json" not found' + Reset);
  }

  let rawData = JSON.parse(fs.readFileSync(__dirname + "/rawAll.json", "utf8"));

  Object.keys(rawData).forEach((key) => {
    data[key] = encrypt(rawData[key], password);
  });

  saveData();

  console.log(FgGreen + "Success" + Reset);
});

CM.add("del", "del <key> | Delete key", (params) => {
  const key = params[0];

  if (!key) {
    return console.log(FgRed + "Wrong arg <key>" + Reset);
  }

  delete data[key];
  saveData();

  console.log(FgGreen + "Success" + Reset);
});

CM.add("list", "list <search?> <-e> | Show key list, -e dencrypts values", (params, flags) => {
  const keys = Object.keys(data);
  let result = "";

  if (params[0]) {
    const filteredKeys = keys.filter((key) => key.toLowerCase().includes(params[0]));

    if (flags.includes("-e")) {
      result = filteredKeys.map((key) => `${key}: ${decrypt(data[key], password)}`).join("\n");
    } else {
      result = filteredKeys.join("\n");
    }
  } else {
    if (flags.includes("-e")) {
      result = keys.map((key) => `${key}: ${decrypt(data[key], password)}\n`).join("\n");
    } else {
      result = keys.join("\n");
    }
  }

  if (!result) {
    return console.log(FgRed + "Nothing found" + Reset);
  }

  console.log(result);
});

CM.add("clear", "Clear console", () => {
  console.clear();
  initMessage();
});

CM.add("exit", "Exit programm", () => {
  process.exit(1);
});

const loop = () => {
  readline.question(FgCyan + pointer + Reset, (input) => {
    let name = input.split(" ")[0];
    let params = input.split(" ").slice(1);

    CM.envoke(name, params).then(() => {
      loop();
    });
  });
};

console.clear();
initMessage();
loop();
