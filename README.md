# mypastebin

A simple pastebin in node, allowing you to post text or file for a limited time.


### Optional encryption for text and files

You can optionally add a password to encrypt text, code, or files.

The password is then turned into a key using PBKDF2 and message is encrypted using AES-GCM with a 256 bits key size. Encryption and decryption is done in the browser. 

The initialization vector (IV) and password’s salt is sent to server.
The purpose of IV and salt is to have different encoded message even if text or password are the same.

### Server details

Texts are stored in memory while files are stored in temporary directory.

A global limit is set for texts (1 Mb) and files (1 Gb), to avoid filling memory or hard drive space.
Also, there’s a limit for each piece of text (100 Kb) and file (250 Mb).
