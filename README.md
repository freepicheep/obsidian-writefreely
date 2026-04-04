# WriteFreely for Obsidian

This Obsidian plugin lets you publish and manage your posts on [WriteFreely](https://writefreely.org/). 

## Authentication

You only need:
1. Your WriteFreely instance url (e.g. "https://write.as")
2. Username
3. Password

The plugin does not store your username or password: it stores the authentication token in Obsidian's new SecretStorage.

## Usage 

You can save your note as a draft, publish it to your collection, or remove it if you have already published it. You can use the available commands from the Command Palette or click on the WriteFreely items in the toolbar or statusbar. 

The WriteFreely post metadata is stored in your notes YAML front matter (Obsidian Properties). This means you can make an [Obsidian Base](https://obsidian.md/help/bases) to view all your WriteFreely posts or query them using [Dataview](https://blacksmithgu.github.io/obsidian-dataview/).
