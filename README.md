# HM-SDS - Sequre Data Storage tool

Stores JSON in encrypted txt file.

Saves data on any edit command.

Type "help" to see how to use the commands.

# example
- pas
- `enter password`
- enc test `any data, for example, some funny lines`
- dec test
- => logs string above

# features

### encall and decall

allows you to edit passwords in editor

- encall: parsing rawAll.json and encrypts all data
- decall: decrypts all your data to rawAll.json

### pas

works like `sudo` in linux (hides input)

### list <search?> <-e>

searches for keys, `-e` flag auto decrypts it
