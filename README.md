# mypastebin

A simple pastebin in node, allowing you to post text or file for a limited time.


### Optional encryption for text

You can optionally add a password to encrypt text (or code).

The password is then turned into a key using PBKDF2 and message is encrypted using AES-CBC with a 256 bits key size. Encryption and decryption is done in the browser. 

The initialization vector (IV) and password’s salt is sent to server.
The purpose of IV and salt is to have different encoded message even if text or password are the same.

Beware, files are not encrypted ! (but you can easily zip your file with a password if needed)


### Server details

Texts are stored in memory while files are stored in temporary directory.

A global limit is set for texts (1 Mb) and files (100 Mb), to avoid filling memory or hard drive space.
Also, there’s a limit for each piece ot text (100 Kb) and file (10 Mb).
