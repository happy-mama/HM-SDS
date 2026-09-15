const crypto = require("node:crypto");
const fs = require("node:fs");
const CONFIG = require("./config.json");
const { isPromise } = require("node:util/types");

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

const FgRed = "\x1b[31m";
const FgGreen = "\x1b[32m";
const FgYellow = "\x1b[33m";
const FgBlue = "\x1b[34m";
const FgMagenta = "\x1b[35m";
const FgCyan = "\x1b[36m";

// #region VARIABLES

let password = "";
let data = {};
let lastInteractionTime = Date.now();
const DATA_FILE_NAME = "data.txt";
const RAW_DATA_FILE_NAME = "rawAll.json";
const NO_PASSWORD_REQUIRED_COMMANDS = [
	"help",
	"pas",
	"syncr",
	"syncs",
	"exit",
	"clear",
];
let pointer = "-> ";
const RANDOM = {
	lowerCase: "abcdefghijklmnopqrstuvwxyz",
	upperCase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
	number: "0123456789",
};

//#region READLINE

const readline = require("node:readline").createInterface({
	input: process.stdin,
	output: process.stdout,
});

//#region CLASSES

class CommandsManager {
	/**
	 * @type {{[key: string]: Command}}
	 */
	commands = {};

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
	invoke(name, params) {
		return new Promise((result) => {
			lastInteractionTime = Date.now();

			const command = this.commands[name];

			if (command) {
				if (!NO_PASSWORD_REQUIRED_COMMANDS.includes(name) && !passCheck())
					return result();

				if (!paramsCheck(command, params)) return result();

				const flags = params.filter((param) => param.startsWith("-"));
				params = params.filter((param) => !param.startsWith("-"));

				const res = command.run(params, flags);

				if (isPromise(res)) {
					res.then(result);
				} else {
					result(res);
				}
			} else {
				console.log(
					FgRed + `Unknown command "${name}". Type "help" for a list.` + Reset,
				);
				result();
			}
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
	run = async () => {};

	constructor(name, description, callback) {
		this.name = name;
		this.description = description;
		this.run = callback;
	}
}

//#region FUNCTIONS

const initMessage = () => {
	console.log(
		Bright +
			FgYellow +
			'HM-SDS tool. Type "help" to see available commands.' +
			Reset,
	);
};

const passCheck = () => {
	if (!password) {
		console.log(
			FgRed +
				'A password is required for this command. Type "pas" to set it.' +
				Reset,
		);
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
	const requiredParams = command.description.params.filter(
		(param) => !param[0].startsWith("?"),
	);

	if (requiredParams.length > params.length) {
		const missingParam = command.description.params[params.length];

		console.log(
			FgRed +
				"Missing required parameter" +
				Reset +
				FgCyan +
				` <${missingParam[0].replace(/^\?/, "")}> ` +
				Reset +
				`${missingParam[1]}`,
		);

		return false;
	}

	return true;
};

const saveData = () => {
	fs.writeFileSync(
		__dirname + "/" + DATA_FILE_NAME,
		encrypt(JSON.stringify(data, null, 2), password),
	);

	if (CONFIG.autoSync) {
		CM.commands.syncs.run();
	}
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
	const salt = crypto.randomBytes(32);
	const key = crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
	const iv = crypto.randomBytes(16);
	const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
	const encrypted = Buffer.concat([
		cipher.update(text, "utf8"),
		cipher.final(),
	]);
	return (
		salt.toString("hex") +
		":" +
		iv.toString("hex") +
		":" +
		encrypted.toString("hex")
	);
}

/**
 * @param {string} text
 * @param {string} password
 * @returns {string}
 */
function decrypt(encrypted, password) {
	try {
		const [saltHex, ivHex, encryptedHex] = encrypted.split(":");
		const salt = Buffer.from(saltHex, "hex");
		const iv = Buffer.from(ivHex, "hex");
		const encryptedText = Buffer.from(encryptedHex, "hex");
		const key = crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
		const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
		const decrypted = Buffer.concat([
			decipher.update(encryptedText),
			decipher.final(),
		]);
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
	const hashHex = hashArray
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
	return hashHex;
}

function fileHash(path) {
	try {
		return crypto
			.createHash("sha256")
			.update(fs.readFileSync(path, "utf-8"))
			.digest("hex");
	} catch {
		return null;
	}
}

function filesEqual(pathA, pathB) {
	const hashA = fileHash(pathA);
	const hashB = fileHash(pathB);
	return hashA !== null && hashA === hashB;
}

function parseTime(str) {
	const match = /^(\d+)(s|m|h)$/.exec(str);
	if (!match) return null;

	const value = Number(match[1]);
	const unit = match[2];

	const multipliers = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000 };
	return value * multipliers[unit];
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
	callback: () => {
		let result = "";
		const keys = Object.keys(CM.commands);

		const legend =
			Bright +
			"Legend:\n" +
			Reset +
			FgGreen +
			"  command" +
			Reset +
			"           — command name\n" +
			FgCyan +
			"  <param>" +
			Reset +
			"           — required parameter\n" +
			FgCyan +
			"  <?param>" +
			Reset +
			'          — optional parameter (the "?" is not typed)\n' +
			FgCyan +
			"  <param+>" +
			Reset +
			"          — takes the rest of the line as one value\n" +
			FgMagenta +
			"  -flag" +
			Reset +
			"             — optional flag, e.g. list -e\n";

		result += legend + "\n";

		keys.forEach((key, i) => {
			const command = CM.commands[key];

			const params = command.description.params.reduce(
				(acc, cur) => acc + `\n  ${FgCyan}<${cur[0]}>${Reset} ${cur[1]}`,
				"",
			);

			const args = command.description.args.reduce(
				(acc, cur) => acc + `\n  ${FgMagenta}${cur[0]}${Reset} ${cur[1]}`,
				"",
			);

			result +=
				`${FgGreen}${key}${Reset}` +
				`\n  ${command.description.main}` +
				params +
				args;

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
	callback: async () => {
		return new Promise((resolve) => {
			if (password) {
				console.log(
					FgYellow +
						`A password is already set for this session.` +
						Reset +
						`\nTo change it, do the following:
1. turn off autosync if you have it enabled
2. back up "${DATA_FILE_NAME}"
3. run "decall"
4. delete "${DATA_FILE_NAME}"
5. restart the CLI
6. run "pas" and type the new password
7. run "encall"`,
				);
				return resolve();
			}

			readline.question(FgMagenta + pointer, async (pass) => {
				readline.output.write = originalWrite;

				readline.history.shift();

				if (CONFIG.autoSync) {
					await CM.commands.syncr.run();
				}

				fs.promises
					.readFile(DATA_FILE_NAME, { encoding: "utf-8" })
					.then((fileContent) => {
						if (fileContent.length) {
							const tempData = decrypt(fileContent, pass);

							if (tempData === "Wrong password") {
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
			readline.output.write = () => {};
		});
	},
});

CM.add({
	name: "enc",
	description: {
		main: `Encrypt a value into "${DATA_FILE_NAME}"`,
		params: [
			["key", "key of the value"],
			["data+", "any value"],
		],
		args: [],
	},
	callback: (params) => {
		const key = params[0];
		const message = params.slice(1).join(" ").replaceAll("\\n", "\n");

		data[key] = encrypt(message, password);

		saveData();

		console.log(FgGreen + "Success" + Reset);
	},
});

CM.add({
	name: "enct",
	description: {
		main: `Encrypt a value into "${DATA_FILE_NAME}" using a login/password template`,
		params: [
			["key", "key of the value"],
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
		main: `Decrypt a key from "${DATA_FILE_NAME}"`,
		params: [["key", "key of the value"]],
		args: [],
	},
	callback: (params) => {
		const key = params[0];

		if (!data[key]) {
			return console.log(FgRed + `No such key in ${DATA_FILE_NAME}` + Reset);
		}

		console.log(decrypt(data[key], password));
	},
});

CM.add({
	name: "decall",
	description: {
		main: `Decrypt all keys from "${DATA_FILE_NAME}" and save output to "${RAW_DATA_FILE_NAME}"`,
		params: [],
		args: [],
	},
	callback: () => {
		const result = {};

		Object.keys(data).forEach((key) => {
			result[key] = decrypt(data[key], password);
		});

		fs.writeFileSync(
			__dirname + "/" + RAW_DATA_FILE_NAME,
			JSON.stringify(result, null, 2),
		);

		console.log(
			FgGreen +
				`Successfully decrypted all data to "${RAW_DATA_FILE_NAME}"` +
				Reset,
		);
	},
});

CM.add({
	name: "encall",
	description: {
		main: `Encrypt all data from "${RAW_DATA_FILE_NAME}" into "${DATA_FILE_NAME}"`,
		params: [],
		args: [["-s", `keep "${RAW_DATA_FILE_NAME}" instead of deleting it`]],
	},
	callback: (_, flags) => {
		const dirData = getDirData();

		if (!dirData.includes(RAW_DATA_FILE_NAME)) {
			return console.log(FgRed + `"${RAW_DATA_FILE_NAME}" not found` + Reset);
		}

		const rawData = JSON.parse(
			fs.readFileSync(__dirname + "/" + RAW_DATA_FILE_NAME, "utf8"),
		);

		Object.keys(rawData).forEach((key) => {
			data[key] = encrypt(rawData[key], password);
		});

		if (!flags.includes("-s")) {
			fs.rmSync(__dirname + "/" + RAW_DATA_FILE_NAME);
		}

		saveData();

		console.log(FgGreen + "Successfully encrypted all data" + Reset);
	},
});

CM.add({
	name: "del",
	description: {
		main: "Delete a key and its value",
		params: [["key", "key of the value"]],
		args: [],
	},
	callback: (params) => {
		const key = params[0];

		if (!data[key]) {
			return console.log(FgRed + `No such key in ${DATA_FILE_NAME}` + Reset);
		}

		delete data[key];
		saveData();

		console.log(FgGreen + "Success" + Reset);
	},
});

CM.add({
	name: "ap",
	description: {
		main: "Append a value to an existing key",
		params: [
			["key", "key of the value"],
			["data+", "any value"],
		],
		args: [],
	},
	callback: (params) => {
		const key = params[0];

		if (!data[key]) {
			return console.log(FgRed + `No such key in ${DATA_FILE_NAME}` + Reset);
		}

		const message = params.slice(1).join(" ").replaceAll("\\n", "\n");

		const value = decrypt(data[key], password);

		CM.commands.enc.run([key, `${value} ${message}`]);
	},
});

CM.add({
	name: "list",
	description: {
		main: "Show the list of keys",
		params: [["?search", "key name"]],
		args: [["-e", "also decrypt and show values"]],
	},
	callback: (params, flags) => {
		const keys = Object.keys(data);
		let result = "";

		if (params[0]) {
			const filteredKeys = keys.filter((key) =>
				key.toLowerCase().includes(params[0]),
			);

			if (flags.includes("-e")) {
				result = filteredKeys
					.map((key) => `${key}: ${decrypt(data[key], password)}`)
					.join("\n");
			} else {
				result = filteredKeys.join("\n");
			}
		} else {
			if (flags.includes("-e")) {
				result = keys
					.map((key) => `${key}: ${decrypt(data[key], password)}`)
					.join("\n");
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
		main: "Generate a random hash",
		params: [["?length", "hash length, default is 64, max is 256"]],
		args: [],
	},
	callback: async (params) => {
		const hashLength = Number(params[0]);

		if (params[0]) {
			if (isNaN(hashLength) || !hashLength) {
				return console.log(FgRed + "Length must be a positive number" + Reset);
			}

			if (hashLength > 256) {
				return console.log(FgRed + "Length must not exceed 256" + Reset);
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
	name: "syncr",
	description: {
		main: "Pull (read) data from the configured sync location",
		params: [],
		args: [],
	},
	callback: async () => {
		if (!CONFIG.syncPath) {
			console.log(FgRed + "syncPath is not set in config.json" + Reset);
			return;
		}

		if (filesEqual(CONFIG.syncPath, DATA_FILE_NAME)) {
			return;
		}

		await fs.promises.copyFile(CONFIG.syncPath, DATA_FILE_NAME).catch(() => {
			console.log(FgRed + "Sync error" + Reset);
			return;
		});

		if (!password) {
			return;
		}

		fs.promises
			.readFile(DATA_FILE_NAME, { encoding: "utf-8" })
			.then((fileContent) => {
				const tempData = decrypt(fileContent, password);

				if (tempData === "Wrong password") {
					console.log(FgRed + tempData + Reset);
					return;
				}

				data = JSON.parse(tempData);
			});
	},
});

CM.add({
	name: "syncs",
	description: {
		main: "Push (write) data to the configured sync location",
		params: [],
		args: [],
	},
	callback: async () => {
		if (!CONFIG.syncPath) {
			console.log(FgRed + "syncPath is not set in config.json" + Reset);
			return;
		}

		await fs.promises
			.copyFile(DATA_FILE_NAME, CONFIG.syncPath)
			.catch(() => console.log(FgRed + "Sync error" + Reset));
	},
});

CM.add({
	name: "clear",
	description: {
		main: "Clear the console",
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
		main: "Exit the program",
		params: [],
		args: [],
	},
	callback: () => {
		if (fs.existsSync(__dirname + "/" + RAW_DATA_FILE_NAME)) {
			fs.rmSync(__dirname + "/" + RAW_DATA_FILE_NAME);
		}

		process.exit(0);
	},
});

//#region run

if (CONFIG.clear) {
	CM.commands.clear.run();
} else {
	initMessage();
}

if (fs.existsSync(__dirname + "/" + RAW_DATA_FILE_NAME)) {
	if (CONFIG.security.deleteRawAllFileOnStart) {
		fs.rmSync(__dirname + "/" + RAW_DATA_FILE_NAME);

		console.log(
			FgRed + `DELETED ${RAW_DATA_FILE_NAME} due to configuration` + Reset,
		);
	} else {
		console.log(
			FgRed +
				`${RAW_DATA_FILE_NAME} still exists in CLI root. Don't leave it decrypted longer than necessary!\nEnable auto-delete in config to fix this automatically.` +
				Reset,
		);
	}
}

if (CONFIG.sessionTimeout.enabled) {
	const limit = parseTime(CONFIG.sessionTimeout.time);

	if (!limit) {
		console.log(
			FgRed +
				"Session timeout time in config is invalid, this feature will not work!" +
				Reset,
		);
	} else {
		setInterval(() => {
			if (Date.now() - lastInteractionTime > limit) {
				if (CONFIG.sessionTimeout.clear) {
					CM.commands.clear.run();
				}

				console.log(FgYellow + "Session timeout" + Reset);

				CM.commands.exit.run();
			}
		}, 1000);
	}
}

const loop = () => {
	readline.question(FgCyan + pointer + Reset, (input) => {
		const name = input.split(" ")[0];
		const params = input
			.split(" ")
			.slice(1)
			.filter((param) => !!param);

		CM.invoke(name, params).then(() => {
			loop();
		});
	});
};

loop();

if (CONFIG.security.deleteRawAllFileOnExit) {
	process.on("exit", CM.commands.exit.run);
	process.on("SIGINT", CM.commands.exit.run);
}
